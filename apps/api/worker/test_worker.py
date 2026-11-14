import concurrent.futures
import threading
import urllib.parse
import unittest
from unittest.mock import patch

import worker


class FakeQueue:
    """Small transactional queue double for claim and concurrency behavior."""

    def __init__(self, rows, select_barrier=None):
        self.rows = rows
        self.select_barrier = select_barrier
        self.guard = threading.Lock()
        self.row_locks = {row["id"]: threading.Lock() for row in rows}

    def connect(self):
        return FakeConnection(self)


class FakeConnection:
    def __init__(self, queue):
        self.queue = queue
        self.locked_row = None

    def cursor(self, dictionary=False):
        return FakeCursor(self, dictionary)

    def commit(self):
        self._release()

    def rollback(self):
        self._release()

    def close(self):
        self._release()

    def _release(self):
        if self.locked_row is not None:
            self.queue.row_locks[self.locked_row].release()
            self.locked_row = None


class FakeCursor:
    def __init__(self, connection, dictionary):
        self.connection = connection
        self.dictionary = dictionary
        self.rowcount = -1
        self.result = None
        self.selected = None

    def execute(self, sql, params=None):
        params = params or ()
        queue = self.connection.queue
        if sql == "START TRANSACTION":
            return
        if sql.startswith("SELECT id,document_id,tenant_id,status,attempts,max_attempts"):
            if queue.select_barrier:
                queue.select_barrier.wait(timeout=5)
            retry_base, retry_max, lease_seconds = params
            with queue.guard:
                for row in sorted(queue.rows, key=lambda item: item["created_at"]):
                    eligible = (
                        row["status"] == "queued" and row["attempts"] < row["max_attempts"]
                    ) or (
                        row["status"] == "retry_wait"
                        and row["attempts"] < row["max_attempts"]
                        and row.get("retry_elapsed", 0) >= min(
                            retry_base * (2 ** max(0, row["attempts"] - 1)), retry_max
                        )
                    ) or (
                        row["status"] == "processing" and row.get("stale_seconds", 0) >= lease_seconds
                    )
                    if eligible and queue.row_locks[row["id"]].acquire(blocking=False):
                        self.connection.locked_row = row["id"]
                        self.selected = row
                        self.result = {key: row[key] for key in (
                            "id", "document_id", "tenant_id", "status", "attempts", "max_attempts"
                        )}
                        break
            return
        if sql.startswith("UPDATE document_processing_jobs"):
            worker_id, job_id, retry_base, retry_max, lease_seconds = params
            row = next((item for item in queue.rows if item["id"] == job_id), None)
            if row is None or self.connection.locked_row != job_id:
                self.rowcount = 0
                return
            eligible = (
                row["status"] == "queued" and row["attempts"] < row["max_attempts"]
            ) or (
                row["status"] == "retry_wait"
                and row["attempts"] < row["max_attempts"]
                and row.get("retry_elapsed", 0) >= min(
                    retry_base * (2 ** max(0, row["attempts"] - 1)), retry_max
                )
            ) or (
                row["status"] == "processing" and row.get("stale_seconds", 0) >= lease_seconds
            )
            self.rowcount = 1 if eligible else 0
            if eligible:
                row["status"] = "processing"
                row["worker_id"] = worker_id
                row["stale_seconds"] = 0
                if row["attempts"] < row["max_attempts"]:
                    row["attempts"] += 1
            return
        if sql.startswith("UPDATE documents SET processing_status='processing'"):
            self.rowcount = 1
            return
        if sql.startswith("UPDATE document_processing_jobs SET updated_at"):
            job_id, worker_id = params
            row = next((item for item in queue.rows if item["id"] == job_id), None)
            self.rowcount = int(bool(row and row["status"] == "processing" and row["worker_id"] == worker_id))
            return
        if sql.startswith("SELECT 1 FROM document_processing_jobs"):
            job_id, worker_id = params
            row = next((item for item in queue.rows if item["id"] == job_id), None)
            self.result = (1,) if row and row["status"] == "processing" and row["worker_id"] == worker_id else None
            return
        raise AssertionError(f"Unexpected SQL in worker claim test: {sql}")

    def fetchone(self):
        return self.result


def make_job(job_id, status, created_at, attempts=0, max_attempts=3, **extra):
    return {
        "id": job_id,
        "document_id": f"document-{job_id}",
        "tenant_id": "tenant-test",
        "status": status,
        "attempts": attempts,
        "max_attempts": max_attempts,
        "created_at": created_at,
        "worker_id": None,
        **extra,
    }


class RetryTests(unittest.TestCase):
    def test_exponential_delay_is_capped(self):
        self.assertEqual([worker.retry_delay_seconds(n) for n in (1, 2, 3, 8)], [30, 60, 120, 3600])

    def test_file_missing_is_permanent_and_actionable(self):
        code, message, retryable = worker.classify_failure(FileNotFoundError("missing"))
        self.assertEqual(code, "DOCUMENT_FILE_NOT_FOUND")
        self.assertFalse(retryable)
        self.assertIn("stored document", message)

    def test_worker_api_server_failure_is_retryable(self):
        self.assertTrue(worker.classify_failure(RuntimeError("OCR_API_HTTP_503"))[2])
        self.assertFalse(worker.classify_failure(RuntimeError("OCR_API_HTTP_404"))[2])

    def test_timeout_retries_and_retry_limit_does_not(self):
        self.assertTrue(worker.classify_failure(TimeoutError("OCR timed out"))[2])
        code, _, retryable = worker.classify_failure(worker.RetryLimitReached("retry limit reached"))
        self.assertEqual(code, "OCR_RETRY_LIMIT_REACHED")
        self.assertFalse(retryable)


class ProductionReadinessTests(unittest.TestCase):
    def test_database_tls_requires_ca_and_hostname_verification(self):
        config = worker.database_config({
            "DATABASE_URL": "mysql://worker:pass@10.0.0.5:3306/ojix",
            "DATABASE_SSL": "true",
            "DATABASE_SSL_CA": "/var/run/secrets/mysql/server-ca.pem",
        })
        self.assertFalse(config["ssl_disabled"])
        self.assertTrue(config["ssl_verify_cert"])
        self.assertTrue(config["ssl_verify_identity"])
        self.assertEqual(config["ssl_ca"], "/var/run/secrets/mysql/server-ca.pem")

    def test_database_tls_is_disabled_for_local_defaults(self):
        config = worker.database_config({"DATABASE_URL": "mysql://worker:pass@localhost/ojix"})
        self.assertTrue(config["ssl_disabled"])
        self.assertNotIn("ssl_ca", config)

    def test_ocr_retrieves_document_from_authenticated_api_route(self):
        job = {"job_id": "job / one", "document_id": "document-1"}
        body = b"private PDF bytes"
        with patch.object(worker, "api_request", return_value=body) as request:
            self.assertEqual(worker.load_document(job), body)
        request.assert_called_once_with(
            "/internal/ocr/jobs/job%20%2F%20one/document", method="GET", timeout=120
        )
class AtomicClaimTests(unittest.TestCase):
    def test_stale_processing_job_is_recovered_and_attempt_increments(self):
        stale = make_job("stale", "processing", 1, attempts=1, stale_seconds=3600)
        queue = FakeQueue([stale])
        with patch.object(worker, "connect", queue.connect), patch.dict("os.environ", {"OCR_JOB_LEASE_SECONDS": "60"}):
            claimed = worker.claim_job("worker-a")
        self.assertEqual(claimed, "stale")
        self.assertEqual(stale["status"], "processing")
        self.assertEqual(stale["attempts"], 2)
        self.assertEqual(stale["worker_id"], "worker-a")

    def test_stale_job_at_retry_limit_is_recovered_without_increment(self):
        stale = make_job("exhausted", "processing", 1, attempts=3, max_attempts=3, stale_seconds=3600)
        queue = FakeQueue([stale])
        with patch.object(worker, "connect", queue.connect), patch.dict("os.environ", {"OCR_JOB_LEASE_SECONDS": "60"}):
            claimed = worker.claim_job("worker-a")
        self.assertEqual(claimed, "exhausted")
        self.assertEqual(stale["attempts"], 3)
        self.assertEqual(stale["worker_id"], "worker-a")

    def test_retry_wait_respects_exponential_delay(self):
        waiting = make_job("retry", "retry_wait", 1, attempts=2, retry_elapsed=59)
        queue = FakeQueue([waiting])
        with patch.object(worker, "connect", queue.connect), patch.dict("os.environ", {"OCR_RETRY_DELAY_SECONDS": "30"}):
            self.assertIsNone(worker.claim_job("worker-a"))
        self.assertEqual(waiting["status"], "retry_wait")
        waiting["retry_elapsed"] = 60
        with patch.object(worker, "connect", queue.connect), patch.dict("os.environ", {"OCR_RETRY_DELAY_SECONDS": "30"}):
            self.assertEqual(worker.claim_job("worker-a"), "retry")

    def test_two_workers_atomically_claim_different_jobs(self):
        barrier = threading.Barrier(2)
        queue = FakeQueue([
            make_job("first", "queued", 1),
            make_job("second", "queued", 2),
        ], select_barrier=barrier)
        with patch.object(worker, "connect", queue.connect):
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                claims = list(pool.map(worker.claim_job, ("worker-a", "worker-b")))
        self.assertEqual(set(claims), {"first", "second"})
        self.assertEqual([row["status"] for row in queue.rows], ["processing", "processing"])
        self.assertEqual(len({row["worker_id"] for row in queue.rows}), 2)


if __name__ == "__main__":
    unittest.main()
