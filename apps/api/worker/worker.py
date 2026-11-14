import json
import io
import logging
import os
import pathlib
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone

import mysql.connector
import tempfile

import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image


LOGGER = logging.getLogger("ojix.ocr_worker")
WORKER_ID = f"{os.environ.get('HOSTNAME', socket.gethostname())}:{os.getpid()}:{uuid.uuid4()}"


class JsonLogFormatter(logging.Formatter):
    def format(self, record):
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "event": getattr(record, "event", record.getMessage()),
            "worker_id": WORKER_ID,
        }
        entry.update(getattr(record, "fields", {}))
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False, default=str)


_handler = logging.StreamHandler()
_handler.setFormatter(JsonLogFormatter())
LOGGER.handlers.clear()
LOGGER.addHandler(_handler)
LOGGER.setLevel(logging.INFO)
LOGGER.propagate = False


def log_event(level, event, **fields):
    LOGGER.log(level, event, extra={"event": event, "fields": fields})


class LostJobLease(RuntimeError):
    """Raised when this worker no longer owns a processing job."""


class RetryLimitReached(RuntimeError):
    """Raised for stale jobs which have exhausted their configured attempts."""


def database_config(env=None):
    env = os.environ if env is None else env
    parsed = urllib.parse.urlparse(env["DATABASE_URL"])
    config = {
        "host": parsed.hostname or "db",
        "port": parsed.port or 3306,
        "user": urllib.parse.unquote(parsed.username or ""),
        "password": urllib.parse.unquote(parsed.password or ""),
        "database": parsed.path.lstrip("/"),
        "autocommit": False,
    }
    tls_enabled = str(env.get("DATABASE_SSL", "false")).strip().lower() in {"1", "true", "yes", "on"}
    config["ssl_disabled"] = not tls_enabled
    if tls_enabled:
        # Require both CA validation and hostname validation for managed MySQL.
        config["ssl_verify_cert"] = True
        config["ssl_verify_identity"] = True
        if env.get("DATABASE_SSL_CA"):
            config["ssl_ca"] = env["DATABASE_SSL_CA"]
    return config


def connect():
    return mysql.connector.connect(**database_config())


def retry_delay_seconds(attempts, base_seconds=30, max_seconds=3600):
    return min(max_seconds, base_seconds * (2 ** max(0, int(attempts) - 1)))


def classify_failure(error):
    error_name = type(error).__name__
    if isinstance(error, RetryLimitReached):
        return "OCR_RETRY_LIMIT_REACHED", str(error), False
    if isinstance(error, FileNotFoundError):
        return "DOCUMENT_FILE_NOT_FOUND", "The API could not provide the stored document to the OCR worker.", False
    if str(error) in {"OCR_EMPTY_TEXT", "OCR_WORKER_TOKEN_NOT_CONFIGURED"}:
        code = str(error)
        messages = {
            "OCR_EMPTY_TEXT": "The provider returned no OCR text for this document.",
            "OCR_WORKER_TOKEN_NOT_CONFIGURED": "The internal OCR worker token is not configured.",
        }
        return code, messages[code], False
    if isinstance(error, RuntimeError) and str(error).startswith("OCR_API_HTTP_"):
        try:
            http_status = int(str(error).rsplit("_", 1)[1])
        except ValueError:
            http_status = 0
        return "OCR_API_UNAVAILABLE", str(error), http_status >= 500 or http_status == 429
    if isinstance(error, (TimeoutError, urllib.error.URLError, mysql.connector.Error)):
        return error_name[:80], str(error)[:1000] or "A transient OCR dependency failed.", True
    return error_name[:80], str(error)[:1000] or "OCR processing failed.", False


def claim_job(worker_id=None):
    worker_id = worker_id or WORKER_ID
    retry_base = max(1, int(os.environ.get("OCR_RETRY_DELAY_SECONDS", "30")))
    retry_max = max(1, int(os.environ.get("OCR_RETRY_MAX_DELAY_SECONDS", "3600")))
    lease_seconds = max(60, int(os.environ.get("OCR_JOB_LEASE_SECONDS", "1800")))
    connection = connect()
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("START TRANSACTION")
        cursor.execute(
            """SELECT id,document_id,tenant_id,status,attempts,max_attempts FROM document_processing_jobs
               WHERE (status='queued' AND attempts < max_attempts)
                  OR (status='retry_wait' AND attempts < max_attempts AND TIMESTAMPDIFF(SECOND,updated_at,NOW(6)) >=
                      LEAST(%s * POW(2,GREATEST(attempts-1,0)),%s))
                  OR (status='processing' AND updated_at <= DATE_SUB(NOW(6), INTERVAL %s SECOND))
               ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED""",
            (
                retry_base,
                retry_max,
                lease_seconds,
            ),
        )
        job = cursor.fetchone()
        if not job:
            connection.rollback()
            return None
        # The row lock makes selection and transition one atomic claim. Stale
        # processing rows must be accepted here as well as in the selector.
        cursor.execute(
            """UPDATE document_processing_jobs
               SET status='processing', progress=5, processing_stage='loading_document',
                   attempts=IF(attempts < max_attempts, attempts+1, attempts),
                   worker_id=%s, started_at=NOW(6), updated_at=NOW(6), completed_at=NULL,
                   error_code=NULL, error_message=NULL
               WHERE id=%s AND (
                    (status='queued' AND attempts < max_attempts)
                 OR (status='retry_wait' AND attempts < max_attempts AND TIMESTAMPDIFF(SECOND,updated_at,NOW(6)) >=
                     LEAST(%s * POW(2,GREATEST(attempts-1,0)),%s))
                 OR (status='processing' AND updated_at <= DATE_SUB(NOW(6), INTERVAL %s SECOND))
               )""",
            (worker_id, job["id"], retry_base, retry_max, lease_seconds),
        )
        if cursor.rowcount != 1:
            connection.rollback()
            return None
        cursor.execute(
            "UPDATE documents SET processing_status='processing' WHERE id=%s AND tenant_id=%s",
            (job["document_id"], job["tenant_id"]),
        )
        connection.commit()
        log_event(logging.INFO, "job_claimed", job_id=job["id"], prior_status=job["status"],
                  recovered_stale_job=job["status"] == "processing",
                  attempts=int(job["attempts"]) + (0 if int(job["attempts"]) >= int(job["max_attempts"]) else 1),
                  max_attempts=int(job["max_attempts"]))
        return job["id"]
    finally:
        connection.close()


def load_job(job_id, worker_id=None):
    worker_id = worker_id or WORKER_ID
    connection = connect()
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """SELECT j.id job_id,j.tenant_id,j.property_id,j.document_id,j.attempts,j.max_attempts,
                      d.storage_key,d.mime_type,d.original_filename
               FROM document_processing_jobs j
               JOIN documents d ON d.id=j.document_id AND d.tenant_id=j.tenant_id
               WHERE j.id=%s AND j.status='processing' AND j.worker_id=%s LIMIT 1""",
            (job_id, worker_id),
        )
        return cursor.fetchone()
    finally:
        connection.close()


def update_progress(job_id, progress, stage, pages_processed=None, worker_id=None):
    worker_id = worker_id or WORKER_ID
    connection = connect()
    try:
        cursor = connection.cursor()
        cursor.execute(
            """UPDATE document_processing_jobs
               SET progress=%s,processing_stage=%s,pages_processed=COALESCE(%s,pages_processed),updated_at=NOW(6)
               WHERE id=%s AND status='processing' AND worker_id=%s""",
            (progress, stage, pages_processed, job_id, worker_id),
        )
        if cursor.rowcount != 1:
            connection.rollback()
            raise LostJobLease(f"Worker no longer owns job {job_id}.")
        cursor.execute(
            "UPDATE documents SET processing_status='processing' WHERE id=(SELECT document_id FROM document_processing_jobs WHERE id=%s AND worker_id=%s)",
            (job_id, worker_id),
        )
        connection.commit()
        log_event(logging.INFO, "job_stage", job_id=job_id, stage=stage, progress=progress,
                  pages_processed=pages_processed)
    finally:
        connection.close()


def heartbeat_job(job_id, worker_id):
    connection = connect()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "UPDATE document_processing_jobs SET updated_at=NOW(6) WHERE id=%s AND status='processing' AND worker_id=%s",
            (job_id, worker_id),
        )
        connection.commit()
        return cursor.rowcount == 1
    finally:
        connection.close()


def assert_job_owned(job_id, worker_id):
    connection = connect()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT 1 FROM document_processing_jobs WHERE id=%s AND status='processing' AND worker_id=%s LIMIT 1",
            (job_id, worker_id),
        )
        if not cursor.fetchone():
            raise LostJobLease(f"Worker no longer owns job {job_id}.")
    finally:
        connection.close()


class JobHeartbeat:
    def __init__(self, job_id, worker_id):
        self.job_id = job_id
        self.worker_id = worker_id
        self.interval = max(5, int(os.environ.get("OCR_HEARTBEAT_SECONDS", "30")))
        self._stop = threading.Event()
        self._lost = threading.Event()
        self._thread = threading.Thread(target=self._run, name=f"ocr-heartbeat-{job_id}", daemon=True)

    def start(self):
        self._thread.start()
        log_event(logging.INFO, "heartbeat_started", job_id=self.job_id, interval_seconds=self.interval)

    def stop(self):
        self._stop.set()
        if self._thread.is_alive():
            self._thread.join(timeout=max(1, self.interval))

    def ensure_owned(self):
        if self._lost.is_set():
            raise LostJobLease(f"Worker lost the lease for job {self.job_id}.")
        assert_job_owned(self.job_id, self.worker_id)

    def _run(self):
        while not self._stop.wait(self.interval):
            try:
                if not heartbeat_job(self.job_id, self.worker_id):
                    self._lost.set()
                    log_event(logging.WARNING, "heartbeat_lease_lost", job_id=self.job_id)
                    return
                log_event(logging.DEBUG, "heartbeat_renewed", job_id=self.job_id)
            except Exception as error:
                log_event(logging.ERROR, "heartbeat_error", job_id=self.job_id,
                          error_type=type(error).__name__, error=str(error)[:500])


def api_request(path, payload=None, method=None, timeout=120):
    token = os.environ.get("OCR_WORKER_TOKEN", "")
    if not token:
        raise RuntimeError("OCR_WORKER_TOKEN_NOT_CONFIGURED")
    api_base = os.environ.get("OCR_API_INTERNAL_URL", "http://api:4000").rstrip("/")
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"{api_base}{path}",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method=method or ("POST" if body is not None else "GET"),
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"OCR_API_HTTP_{error.code}") from error


def load_document(job):
    # Fetch through the API that owns the configured storage provider. This works
    # for local disk uploads, Docker volumes, and private object storage alike.
    log_event(logging.INFO, "document_download_started", job_id=job["job_id"], document_id=job["document_id"])
    response = api_request(
        f"/internal/ocr/jobs/{urllib.parse.quote(str(job['job_id']), safe='')}/document",
        method="GET",
        timeout=120,
    )
    if not response:
        raise RuntimeError("DOCUMENT_FILE_EMPTY")
    log_event(logging.INFO, "document_download_completed", job_id=job["job_id"], byte_count=len(response))
    return response


def process_with_tesseract(job, content, worker_id=None):
    worker_id = worker_id or WORKER_ID
    languages = os.environ.get("OCR_LANGUAGES", "kan+eng")
    max_pages = min(10, max(1, int(os.environ.get("OCR_MAX_PAGES", "5"))))
    timeout = max(1000, int(os.environ.get("OCR_TIMEOUT_MS", "120000"))) / 1000
    with tempfile.TemporaryDirectory(prefix="ojix-tesseract-"):
        if job.get("mime_type") == "application/pdf" or pathlib.Path(job.get("original_filename", "")).suffix.lower() == ".pdf":
            log_event(logging.INFO, "pdf_render_started", job_id=job["job_id"], max_pages=max_pages, dpi=220)
            images = convert_from_bytes(content, dpi=220, first_page=1, last_page=max_pages, fmt="png", timeout=timeout)
        else:
            log_event(logging.INFO, "image_decode_started", job_id=job["job_id"])
            images = [Image.open(io.BytesIO(content))]
        if not images:
            raise RuntimeError("No readable pages were produced from the document.")
        log_event(logging.INFO, "pages_ready", job_id=job["job_id"], page_count=len(images))
        pages = []
        tokens = []
        for index, image in enumerate(images, start=1):
            update_progress(job["job_id"], min(20 + int(50 * (index - 1) / len(images)), 70), "tesseract_processing", index - 1, worker_id)
            log_event(logging.INFO, "page_ocr_started", job_id=job["job_id"], page_number=index,
                      width=image.width, height=image.height, languages=languages)
            data = pytesseract.image_to_data(image, lang=languages, config="--psm 6", timeout=timeout, output_type=pytesseract.Output.DICT)
            page_tokens = []
            width, height = image.size
            for token_index, value in enumerate(data["text"]):
                value = value.strip()
                try:
                    confidence = float(data["conf"][token_index]) / 100
                except (TypeError, ValueError):
                    continue
                if not value or confidence < 0:
                    continue
                token = {
                    "text": value,
                    "pageNumber": index,
                    "confidence": min(1, confidence),
                    "bbox": {
                        "xmin": data["left"][token_index] / width,
                        "ymin": data["top"][token_index] / height,
                        "xmax": (data["left"][token_index] + data["width"][token_index]) / width,
                        "ymax": (data["top"][token_index] + data["height"][token_index]) / height,
                    },
                }
                page_tokens.append(token)
                tokens.append(token)
            text = pytesseract.image_to_string(image, lang=languages, config="--psm 6", timeout=timeout).strip()
            page_confidence = sum(token["confidence"] for token in page_tokens) / len(page_tokens) if page_tokens else 0
            pages.append({"pageNumber": index, "text": text, "confidence": page_confidence, "tokenCount": len(page_tokens)})
            log_event(logging.INFO, "page_ocr_completed", job_id=job["job_id"], page_number=index,
                      character_count=len(text), token_count=len(page_tokens), confidence=round(page_confidence, 4))
        full_text = "\n\n".join("--- Page {} ---\n{}".format(page["pageNumber"], page["text"]) for page in pages if page["text"]).strip()
        if len(full_text) < 20:
            raise RuntimeError("OCR_EMPTY_TEXT")
        update_progress(job["job_id"], 75, "persisting_results", len(pages), worker_id)
        log_event(logging.INFO, "ocr_inference_completed", job_id=job["job_id"], page_count=len(pages),
                  character_count=len(full_text), token_count=len(tokens))
        return {"provider": "tesseract", "providerVersion": "local", "pageCount": len(pages), "text": full_text, "tokens": tokens, "pages": pages}

def callback(path, payload):
    return api_request(f"/internal/ocr/jobs/{path}", payload=payload, method="POST", timeout=120)


def fail_job(job_id, error):
    error_code, message, retryable = classify_failure(error)
    log_event(logging.ERROR, "job_failed", job_id=job_id, error_code=error_code,
              retryable=retryable, error_message=message)
    result = callback("fail", {"jobId": job_id, "errorCode": error_code, "errorMessage": message, "retryable": retryable})
    try:
        response = json.loads(result.decode("utf-8")) if result else {}
    except (UnicodeDecodeError, json.JSONDecodeError):
        response = {}
    log_event(logging.INFO, "job_failure_persisted", job_id=job_id, status=response.get("status"))


def run_job(job_id, worker_id=None):
    worker_id = worker_id or WORKER_ID
    heartbeat = JobHeartbeat(job_id, worker_id)
    heartbeat.start()
    log_event(logging.INFO, "job_processing_started", job_id=job_id)
    try:
        job = load_job(job_id, worker_id)
        if not job:
            log_event(logging.WARNING, "claimed_job_unavailable", job_id=job_id)
            return
        if int(job["attempts"]) >= int(job["max_attempts"]):
            heartbeat.stop()
            heartbeat.ensure_owned()
            fail_job(job_id, RetryLimitReached("OCR job exceeded its maximum attempts after a worker lease expired."))
            return
        log_event(logging.INFO, "job_attempt_started", job_id=job_id, attempt=int(job["attempts"]),
                  max_attempts=int(job["max_attempts"]))
        content = load_document(job)
        heartbeat.ensure_owned()
        result = process_with_tesseract(job, content, worker_id)
        heartbeat.stop()
        heartbeat.ensure_owned()
        callback("complete", {"jobId": job_id, **result})
        log_event(logging.INFO, "job_completed", job_id=job_id, page_count=result["pageCount"],
                  character_count=len(result["text"]), provider=result["provider"])
    except LostJobLease as error:
        log_event(logging.WARNING, "job_processing_abandoned", job_id=job_id, reason=str(error))
    except Exception as error:  # Report a safe error to the application, never raw document content.
        log_event(logging.ERROR, "job_processing_error", job_id=job_id,
                  error_type=type(error).__name__, error=str(error)[:1000])
        heartbeat.stop()
        try:
            heartbeat.ensure_owned()
            fail_job(job_id, error)
        except LostJobLease as lease_error:
            log_event(logging.WARNING, "failure_report_skipped_lease_lost", job_id=job_id,
                      reason=str(lease_error))
        except Exception as persist_error:
            log_event(logging.ERROR, "failure_persistence_error", job_id=job_id,
                      error_type=type(persist_error).__name__, error=str(persist_error)[:1000])
    finally:
        heartbeat.stop()


def main():
    poll_seconds = max(1, int(os.environ.get("OCR_WORKER_POLL_SECONDS", "3")))
    log_event(logging.INFO, "worker_started", poll_seconds=poll_seconds,
              languages=os.environ.get("OCR_LANGUAGES", "kan+eng"),
              max_pages=min(10, max(1, int(os.environ.get("OCR_MAX_PAGES", "5")))),
              lease_seconds=max(60, int(os.environ.get("OCR_JOB_LEASE_SECONDS", "1800"))))
    while True:
        try:
            job_id = claim_job()
            if job_id:
                run_job(job_id, WORKER_ID)
            else:
                time.sleep(poll_seconds)
        except Exception as error:
            log_event(logging.ERROR, "queue_poll_error", error_type=type(error).__name__,
                      error=str(error)[:1000])
            time.sleep(poll_seconds)


if __name__ == "__main__":
    main()
