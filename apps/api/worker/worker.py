import json
import os
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

import mysql.connector
from google.api_core.client_options import ClientOptions
from google.cloud import documentai_v1 as documentai


def database_config():
    parsed = urllib.parse.urlparse(os.environ["DATABASE_URL"])
    return {
        "host": parsed.hostname or "db",
        "port": parsed.port or 3306,
        "user": urllib.parse.unquote(parsed.username or ""),
        "password": urllib.parse.unquote(parsed.password or ""),
        "database": parsed.path.lstrip("/"),
        "autocommit": False,
    }


def connect():
    return mysql.connector.connect(**database_config())


def claim_job():
    connection = connect()
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("START TRANSACTION")
        cursor.execute(
            """SELECT id FROM document_processing_jobs
               WHERE status='queued' AND attempts < max_attempts
               ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED"""
        )
        job = cursor.fetchone()
        if not job:
            connection.rollback()
            return None
        worker_id = os.environ.get("HOSTNAME", "ojix-document-ai-worker")
        cursor.execute(
            """UPDATE document_processing_jobs
               SET status='processing', progress=5, attempts=attempts+1,
                   worker_id=%s, started_at=NOW(6), error_code=NULL, error_message=NULL
               WHERE id=%s AND status='queued'""",
            (worker_id, job["id"]),
        )
        connection.commit()
        return job["id"] if cursor.rowcount else None
    finally:
        connection.close()


def load_job(job_id):
    connection = connect()
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """SELECT j.id job_id,j.tenant_id,j.property_id,j.document_id,j.attempts,j.max_attempts,
                      d.storage_key,d.mime_type,d.original_filename,
                      c.project_id,c.location,c.processor_id,c.processor_version,c.language_hints
               FROM document_processing_jobs j
               JOIN documents d ON d.id=j.document_id AND d.tenant_id=j.tenant_id
               LEFT JOIN document_ai_config c ON c.tenant_id=j.tenant_id
               WHERE j.id=%s LIMIT 1""",
            (job_id,),
        )
        return cursor.fetchone()
    finally:
        connection.close()


def update_progress(job_id, progress):
    connection = connect()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "UPDATE document_processing_jobs SET progress=%s,updated_at=NOW(6) WHERE id=%s AND status='processing'",
            (progress, job_id),
        )
        connection.commit()
    finally:
        connection.close()


def load_document(job):
    key = str(job["storage_key"])
    if key.startswith("supabase:"):
        base = os.environ.get("SUPABASE_URL", "").rstrip("/")
        service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "private-documents")
        if not (base and service_key):
            raise RuntimeError("SUPABASE_STORAGE_NOT_CONFIGURED")
        object_key = key.removeprefix("supabase:")
        encoded_key = urllib.parse.quote(object_key, safe='/')
        url = f"{base}/storage/v1/object/authenticated/{urllib.parse.quote(bucket, safe='')}/{encoded_key}"
        request = urllib.request.Request(url, headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"})
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.read()
    local_path = pathlib.Path(os.environ.get("UPLOAD_DIR", "/app/uploads")) / pathlib.Path(key).name
    return local_path.read_bytes()


def process_with_document_ai(job, content):
    project = job.get("project_id") or os.environ.get("DOCUMENT_AI_PROJECT_ID", "")
    location = job.get("location") or os.environ.get("DOCUMENT_AI_LOCATION", "us")
    processor = job.get("processor_id") or os.environ.get("DOCUMENT_AI_PROCESSOR_ID", "")
    version = job.get("processor_version") or os.environ.get("DOCUMENT_AI_PROCESSOR_VERSION", "")
    if not (project and location and processor):
        raise RuntimeError("DOCUMENT_AI_NOT_CONFIGURED")

    endpoint = f"{location}-documentai.googleapis.com"
    client = documentai.DocumentProcessorServiceClient(client_options=ClientOptions(api_endpoint=endpoint))
    processor_path = (
        client.processor_version_path(project, location, processor, version)
        if version
        else client.processor_path(project, location, processor)
    )
    update_progress(job["job_id"], 20)
    response = client.process_document(
        request=documentai.ProcessRequest(
            name=processor_path,
            raw_document=documentai.RawDocument(content=content, mime_type=job["mime_type"]),
        )
    )
    document = response.document
    full_text = document.text or ""
    tokens = []
    for page_index, page in enumerate(document.pages, start=1):
        for token in page.tokens:
            segments = token.layout.text_anchor.text_segments
            if not segments:
                continue
            start = int(segments[0].start_index or 0)
            end = int(segments[-1].end_index or start)
            value = full_text[start:end].strip()
            if not value:
                continue
            vertices = token.layout.bounding_poly.normalized_vertices
            if not vertices:
                box = {"ymin": 0, "xmin": 0, "ymax": 0, "xmax": 0}
            else:
                xs = [vertex.x for vertex in vertices]
                ys = [vertex.y for vertex in vertices]
                box = {"ymin": min(ys), "xmin": min(xs), "ymax": max(ys), "xmax": max(xs)}
            tokens.append({
                "text": value,
                "pageNumber": page_index,
                "bbox": box,
                "confidence": float(token.layout.confidence),
            })
    update_progress(job["job_id"], 75)
    return {
        "provider": "google_document_ai",
        "providerVersion": version or processor,
        "pageCount": len(document.pages),
        "text": full_text,
        "tokens": tokens,
    }


def callback(path, payload):
    token = os.environ.get("OCR_WORKER_TOKEN", "")
    if not token:
        raise RuntimeError("OCR_WORKER_TOKEN_NOT_CONFIGURED")
    api_base = os.environ.get("OCR_API_INTERNAL_URL", "http://api:4000").rstrip("/")
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        f"{api_base}/internal/ocr/jobs/{path}",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        response.read()


def fail_job(job_id, error):
    error_code = str(error).split(":", 1)[0][:80]
    message = {
        "DOCUMENT_AI_NOT_CONFIGURED": "Google Document AI processor settings are missing. Configure the processor in Admin Integrations.",
        "GOOGLE_CLOUD_AUTH_NOT_CONFIGURED": "Google Cloud application credentials are unavailable to the OCR worker.",
        "SUPABASE_STORAGE_NOT_CONFIGURED": "Private document storage credentials are unavailable to the OCR worker.",
        "OCR_WORKER_TOKEN_NOT_CONFIGURED": "The internal OCR worker token is not configured.",
    }.get(error_code, "Document AI processing failed. Review worker logs and retry the job.")
    callback("fail", {"jobId": job_id, "errorCode": error_code, "errorMessage": message})


def run_job(job_id):
    try:
        job = load_job(job_id)
        if not job:
            return
        content = load_document(job)
        result = process_with_document_ai(job, content)
        callback("complete", {"jobId": job_id, **result})
    except Exception as error:  # Report a safe error to the application, never raw document content.
        print(f"OCR job {job_id} failed: {type(error).__name__}: {error}", flush=True)
        try:
            fail_job(job_id, str(error))
        except Exception as persist_error:
            print(f"Could not save OCR failure state for {job_id}: {type(persist_error).__name__}", flush=True)


def main():
    poll_seconds = max(1, int(os.environ.get("OCR_WORKER_POLL_SECONDS", "3")))
    while True:
        try:
            job_id = claim_job()
            if job_id:
                run_job(job_id)
            else:
                time.sleep(poll_seconds)
        except Exception as error:
            print(f"OCR worker queue error: {type(error).__name__}: {error}", flush=True)
            time.sleep(poll_seconds)


if __name__ == "__main__":
    main()
