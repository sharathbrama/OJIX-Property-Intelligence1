# Milestone 1 Adversarial Challenge Report: Document Intelligence API & Review UI

**Agent**: `challenger_m1_2` (Empirical Challenger)  
**Parent / Caller**: `3d42048c-91f5-4f22-8a89-e9bee87cdb59`  
**Working Directory**: `/Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/challenger_m1_2`  
**Timestamp**: 2026-09-30T15:35:00Z  
**Verdict**: **`REQUEST_CHANGES`**

---

## 1. Observation

### Observation 1: Path Traversal Vulnerability in File Streaming (`GET /file`) and Extraction (`POST /extract`)
- **File**: `apps/api/src/server.ts`, lines 238 & 262:
  ```typescript
  // Line 238 (GET /api/properties/:id/documents/:docId/file)
  const doc = docResult.rows[0];
  const filePath = path.join(uploadDir, doc.storage_key);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Document file not found on disk.' });
  }
  ...
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);

  // Line 262 (POST /api/properties/:id/documents/:docId/extract)
  const filePath = path.join(uploadDir, doc.storage_key);
  let fileBuffer: Buffer | undefined;
  if (fs.existsSync(filePath)) {
    try {
      fileBuffer = fs.readFileSync(filePath);
    } catch (e) { ... }
  }
  ```
- **Empirical Execution & Result**:
  When inserting a document with `storage_key = '../package.json'` into PostgreSQL and executing `GET /api/properties/:id/documents/:docId/file`:
  ```
  HTTP/1.1 200 OK
  Content-Type: application/json
  Content-Disposition: inline; filename="..."

  {
    "name": "@ojix/property-api",
    "version": "0.1.0",
    "private": true,
    ...
  }
  ```
  The endpoint traversed out of `./uploads` and streamed `apps/api/package.json`. If `storage_key` is set to `../.env` or `../../../../etc/passwd`, arbitrary host files are read and streamed to the caller, or ingested into `extracted_text` and `extracted_fields` in the database.

### Observation 2: Reviewer Override Fails to Reject Missing or Whitespace Rationale
- **File**: `apps/api/src/server.ts`, lines 333–368:
  ```typescript
  const { fieldPath, newValue, rationale, overrides } = req.body || {};
  if (!rationale && !overrides && !fieldPath && req.body?.isVerified === undefined) {
    return res.status(400).json({ error: 'Rationale and field updates are required for reviewer overrides.' });
  }
  ...
  if (fieldPath) {
    const previousValue = getNestedValue(currentFields, fieldPath);
    setNestedValue(currentFields, fieldPath, newValue);
    currentFields.reviewState.overrides[fieldPath] = {
      previousValue,
      newValue,
      rationale: rationale || 'Manual correction by reviewer',
      reviewerUid: req.user?.uid || 'unknown',
      updatedAt: new Date().toISOString(),
    };
  }
  ```
- **Contrast with Oracle Contract & UI**:
  - `apps/api/test/contract-oracle.ts`, lines 367–369:
    ```typescript
    if (!rationale || rationale.trim().length === 0) {
      throw new Error('Override rationale is mandatory');
    }
    ```
  - `apps/web/src/components/SideBySideReview.tsx`, lines 275–277 & 876–878:
    ```typescript
    if (!overrideModal.rationale.trim()) {
      alert('A review rationale is mandatory when overriding extracted document fields.');
      return;
    }
    ```
- **Empirical Execution & Result**:
  1. Sending `PATCH /api/properties/:id/documents/:docId/fields` with `{ fieldPath: 'documentNumber', newValue: 'TEST-123' }` (omitting `rationale`) returned **`200 OK`**. The backend silently synthesized `'Manual correction by reviewer'`.
  2. Sending `{ fieldPath: 'documentNumber', newValue: 'TEST-123', rationale: '   ' }` returned **`200 OK`** and stored `'   '` as the rationale.
  3. Sending `{ overrides: { 'documentNumber': { newValue: '...' } } }` returned **`200 OK`** and synthesized `'Reviewer manual override'`.
  This contradicts the requirement that missing rationale must be rejected with 400 Bad Request.

### Observation 3: Prototype Pollution in `setNestedValue`
- **File**: `apps/api/src/server.ts`, lines 176–188:
  ```typescript
  function setNestedValue(obj: any, pathStr: string, value: any): void {
    if (!obj || !pathStr) return;
    const parts = pathStr.split('.');
    let curr = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!curr[part] || typeof curr[part] !== 'object') {
        curr[part] = {};
      }
      curr = curr[part];
    }
    curr[parts[parts.length - 1]] = value;
  }
  ```
- **Empirical Execution & Result**:
  Executing `setNestedValue(target, '__proto__.challengerPollutionFlag', 'compromised')` sets `Object.prototype.challengerPollutionFlag = 'compromised'`. Any plain object instantiated in the Node.js process inherits this property.

### Observation 4: Tenant Boundary Enforcement Verification
- **File**: `apps/api/src/server.ts`, lines 120, 233, 257, 323:
  ```typescript
  SELECT * FROM documents WHERE id=$1 AND property_id=$2 AND tenant_id=$3
  ```
- **Empirical Execution & Result**:
  Created Tenant 1 (`11111111-1111-4111-8111-111111111111`) and Tenant 2 (`99999999-9999-4999-8999-999999999999`). When authenticated as Tenant 1:
  - `GET /api/properties/:prop2` -> `404 Not Found`
  - `GET /api/properties/:prop2/documents/:doc2/file` -> `404 Not Found`
  - `GET /api/properties/:prop1/documents/:doc2/file` (cross-property spoofing) -> `404 Not Found`
  - `POST /api/properties/:prop2/documents/:doc2/extract` -> `404 Not Found`
  - `PATCH /api/properties/:prop2/documents/:doc2/fields` -> `404 Not Found`
  Tenant isolation is strictly verified.

### Observation 5: Missing Database Migration Script for `doc_type`
- **File**: `infra/db/schema.sql`, line 64 (`doc_type varchar(50)`).
- **Tool Output**:
  Running `psql infra/db/schema.sql` against an existing database produced:
  ```
  psql:infra/db/schema.sql:75: NOTICE: relation "documents" already exists, skipping
  psql:infra/db/schema.sql:77: ERROR: column "doc_type" does not exist
  ```
  Because `schema.sql` uses `CREATE TABLE IF NOT EXISTS`, existing databases were never updated with `doc_type`, causing unhandled 500 errors on all document routes until manual execution of `ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type varchar(50);`.

### Observation 6: Unhandled 500 Crash on Malformed Route Parameters
- **Tool Command**: `curl http://localhost:4000/api/properties/22222222-2222-4222-8222-222222222222/documents/not-a-valid-uuid/file`
- **Result**: `500 Internal Server Error` (`{"error":"Internal server error."}`).
- Route parameters (`id`, `docId`) are not validated as UUIDs before querying PostgreSQL, causing unhandled database exceptions instead of returning 400 Bad Request or 404 Not Found.

---

## 2. Logic Chain

1. **Path Traversal Risk**:
   - Observation 1 shows that `path.join(uploadDir, doc.storage_key)` directly resolves relative path segments (`..`).
   - Node.js `path.join('/app/uploads', '../package.json')` evaluates to `/app/package.json`.
   - Because `server.ts` does not verify `path.resolve(uploadDir, doc.storage_key).startsWith(uploadDir + path.sep)`, any document whose `storage_key` contains relative traversal characters causes the server to stream or extract arbitrary files from the filesystem.
2. **Reviewer Override Rationale Bypass**:
   - Observation 2 demonstrates that the condition `if (!rationale && !overrides && !fieldPath && req.body?.isVerified === undefined)` only triggers 400 if *none* of the fields are present.
   - When `fieldPath` is present, `!fieldPath` is `false`, bypassing the check entirely.
   - Line 350 (`rationale || 'Manual correction by reviewer'`) and line 364 (`ov.rationale || rationale || 'Reviewer manual override'`) silently substitute default rationales.
   - This bypasses legal accountability and violates the requirement that missing rationale must be rejected.
3. **Prototype Pollution**:
   - Observation 3 proves that `setNestedValue` splits `fieldPath` by `.` and traverses without property name sanitization.
   - Accessing `obj['__proto__']` returns `Object.prototype`, allowing attackers to mutate base object properties in memory.
4. **Tenant Isolation Strength**:
   - Observation 4 confirms that SQL parameterized queries consistently bind `tenant_id = $3`, successfully blocking cross-tenant retrieval, streaming, extraction, and override attempts.

---

## 3. Caveats

- In development mode without Firebase configured, authentication relies on mock identity (`local-developer`), and authorization roles are derived from `org_memberships`. Production deployments using live Firebase ID tokens must ensure similar tenant ID claims are validated.
- The path traversal vulnerability requires a document record to have a traversed `storage_key`. While `POST /documents` uploads generate UUID keys via Multer, any database migration, seed, administrative update, or secondary import route that writes to `documents.storage_key` will trigger arbitrary file exposure unless protected at the route level.

---

## 4. Conclusion

**Verdict**: **`REQUEST_CHANGES`**

Milestone 1 cannot be approved in its current state due to critical security and validation flaws:
1. **Critical Vulnerability**: File streaming route (`GET /file`) and extraction route (`POST /extract`) allow path traversal outside the upload directory when `storage_key` contains `..`.
2. **High Severity Bug**: Reviewer override route (`PATCH /fields`) accepts field modifications with missing or whitespace-only rationale, silently synthesizing dummy text instead of rejecting with `400 Bad Request`.
3. **High Severity Vulnerability**: Prototype pollution in `setNestedValue` allows modifying `Object.prototype` via `__proto__` in `fieldPath`.
4. **Medium Severity Bug**: Missing migration logic for `doc_type` column causes 500 errors on fresh/existing database instances.

### Required Changes for Approval:
1. **Path Traversal Guard**:
   In `apps/api/src/server.ts` (both `GET /file` and `POST /extract`):
   ```typescript
   const resolvedPath = path.resolve(uploadDir, doc.storage_key);
   const safePrefix = uploadDir.endsWith(path.sep) ? uploadDir : uploadDir + path.sep;
   if (!resolvedPath.startsWith(safePrefix) || !fs.existsSync(resolvedPath)) {
     return res.status(404).json({ error: 'Document file not found or invalid path.' });
   }
   ```
2. **Strict Rationale Validation**:
   In `PATCH /api/properties/:id/documents/:docId/fields`:
   - If `fieldPath` is provided: require `typeof rationale === 'string' && rationale.trim().length > 0`. If missing or whitespace, return `400 Bad Request` with `{ error: 'Reviewer rationale is mandatory when overriding document fields.' }`.
   - If `overrides` object is provided: require each entry to have a non-empty rationale or top-level rationale.
   - Remove automatic fallback strings (`'Manual correction by reviewer'`).
3. **Prototype Pollution Protection**:
   In `setNestedValue` and `getNestedValue`:
   ```typescript
   if (pathStr.split('.').some(part => part === '__proto__' || part === 'constructor' || part === 'prototype')) {
     return; // Or throw 400 Bad Request
   }
   ```
4. **Database Migration**:
   Include `ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type varchar(50);` in migration or schema initialization.

---

## 5. Verification Method

To independently reproduce and verify all findings:

1. **Execute Empirical Adversarial Test Suite**:
   ```bash
   npx tsx --test apps/api/test/challenger-adversarial-server.test.ts
   ```
   Output confirms:
   - Path traversal leak of `apps/api/package.json` (`CHALLENGER VULNERABILITY: Path Traversal in GET ...`).
   - Missing rationale accepted with 200 OK (`CHALLENGER VULNERABILITY: PATCH /fields fails to reject missing rationale`).
   - Whitespace rationale accepted (`CHALLENGER VULNERABILITY: PATCH /fields accepts whitespace-only rationale`).
   - Prototype pollution via `__proto__` (`CHALLENGER VULNERABILITY: Prototype Pollution in setNestedValue`).
   - Strict tenant boundary isolation (`CHALLENGER VERIFICATION: Tenant Boundary Enforcement is strictly enforced...`).

2. **Run Full Project Test Suite**:
   ```bash
   npm test
   ```
   Confirms all 304 tests run, including the adversarial harness.

3. **Verify Typecheck and Build**:
   ```bash
   npm run typecheck
   npm run build
   ```
