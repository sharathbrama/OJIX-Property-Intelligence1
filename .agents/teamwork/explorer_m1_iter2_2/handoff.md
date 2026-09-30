# Technical Exploration & Exact Fix Plan Report

**Author**: `explorer_m1_iter2_2` (Technical Exploration Agent)  
**Parent / Caller**: `3d42048c-91f5-4f22-8a89-e9bee87cdb59`  
**Working Directory**: `/Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/explorer_m1_iter2_2`  
**Timestamp**: 2026-09-30T15:47:00Z  
**Type**: Hard Handoff (Investigation & Fix Plan Complete)  

---

## Executive Summary
This report presents a forensic investigation and line-by-line implementation plan for three defects in Milestone 1:
1. **CRITICAL Prototype Pollution** in `apps/api/src/server.ts:176-188` (`setNestedValue` and `PATCH /api/properties/:id/documents/:docId/fields`).
2. **Path Traversal Vulnerability** in `apps/api/src/server.ts:238-252` (`GET /api/properties/:id/documents/:docId/file` and `POST /extract`).
3. **Multi-Page Pagination & Page Count Defect** in `apps/web/src/components/SideBySideReview.tsx:448-456` and lines 191–203.

---

## 1. Observation

### 1.1 Observation 1: Prototype Pollution in `apps/api/src/server.ts:176-188`
In `apps/api/src/server.ts:176-188`:
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
At lines 346–347 and lines 360–361 in the `PATCH /api/properties/:id/documents/:docId/fields` handler:
```typescript
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

  if (overrides && typeof overrides === 'object') {
    for (const [key, ov] of Object.entries(overrides as Record<string, any>)) {
      const prev = ov.previousValue !== undefined ? ov.previousValue : getNestedValue(currentFields, key);
      const next = ov.newValue;
      setNestedValue(currentFields, key, next);
      currentFields.reviewState.overrides[key] = {
        previousValue: prev,
        newValue: next,
        rationale: ov.rationale || rationale || 'Reviewer manual override',
        reviewerUid: req.user?.uid || 'unknown',
        updatedAt: new Date().toISOString(),
      };
    }
  }
```
**Empirical Vulnerability Confirmation**:
In `apps/api/test/challenger-adversarial-server.test.ts:156-177`:
```typescript
test('CHALLENGER VULNERABILITY: Prototype Pollution in setNestedValue', () => {
  ...
  const target: any = {};
  testSetNestedValue(target, '__proto__.challengerPollutionFlag', 'compromised');

  const cleanObject: any = {};
  assert.equal(cleanObject.challengerPollutionFlag, 'compromised', 'Prototype pollution successfully executed');
  delete (Object.prototype as any).challengerPollutionFlag;
});
```
When `pathStr` contains `__proto__`, `curr['__proto__']` evaluates to `Object.prototype`. The subsequent assignment attaches property `.challengerPollutionFlag` directly to `Object.prototype`. Every JavaScript object in the Node.js process inherits this property, breaking tenant isolation and application security. Furthermore, assigning `currentFields.reviewState.overrides[fieldPath]` when `fieldPath === '__proto__'` also mutates prototype properties on plain objects.

### 1.2 Observation 2: Path Traversal in File Streaming and Extraction
In `apps/api/src/server.ts:238-242` (`GET /api/properties/:id/documents/:docId/file`):
```typescript
  const doc = docResult.rows[0];
  const filePath = path.join(uploadDir, doc.storage_key);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Document file not found on disk.' });
  }
```
And in `apps/api/src/server.ts:262-268` (`POST /api/properties/:id/documents/:docId/extract`):
```typescript
  const doc = docResult.rows[0];
  const filePath = path.join(uploadDir, doc.storage_key);

  let fileBuffer: Buffer | undefined;
  if (fs.existsSync(filePath)) {
    try {
      fileBuffer = fs.readFileSync(filePath);
    } catch (e) {
      console.warn('Could not read file from storage:', e);
    }
  }
```
**Empirical Vulnerability Confirmation**:
In `apps/api/test/challenger-adversarial-server.test.ts:16-54`:
When a document record with `storage_key: '../package.json'` was inserted into the database, calling `GET /api/properties/:id/documents/:docId/file` resolved `path.join('/.../uploads', '../package.json')` to the host directory `apps/api/package.json`. The server successfully streamed `package.json` to the HTTP client with HTTP 200 OK.

### 1.3 Observation 3: Hardcoded Single Page & Disabled Navigation in SideBySideReview UI
In `apps/web/src/components/SideBySideReview.tsx:440-456`:
```tsx
            <div className="page-nav">
              <button
                className="icon-btn-small"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft size={16} />
              </button>
              <span>Page {currentPage} of 1</span>
              <button
                className="icon-btn-small"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={true}
              >
                <ChevronRight size={16} />
              </button>
            </div>
```
In `apps/web/src/components/SideBySideReview.tsx:191-203`:
```tsx
      // Boundaries
      if (sched.boundaries?.north) {
        boxes.push({
          fieldId: 'boundaries',
          label: 'Schedule Boundaries',
          pageNumber: 1, // HARDCODED 1, ignores sched.evidenceAnchor?.pageNumber
          ymin: 0.62,
          xmin: 0.10,
          ymax: 0.74,
          xmax: 0.90,
          confidence: fields.fieldConfidence?.boundaries ?? 0.88,
          snippet: `N: ${sched.boundaries.north}, S: ${sched.boundaries.south}`,
        });
      }
```
In `apps/web/src/components/SideBySideReview.tsx:247-259`:
```tsx
  const handleFieldFocus = (fieldId: string) => {
    setFocusedFieldId(fieldId);
    const box = allBoxes.find((b) => b.fieldId === fieldId);
    if (box) {
      if (box.pageNumber !== currentPage) {
        setCurrentPage(box.pageNumber);
      }
      const boxElem = document.getElementById(`bbox-${fieldId}`);
      if (boxElem) {
        boxElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };
```
**Observed Behavior**:
1. When a document contains evidence anchors on page 2 or 3 (e.g. Schedule Property on page 2, Consideration on page 3), clicking that field in the form jumps `currentPage` to 2.
2. The toolbar then displays `Page 2 of 1`, which is confusing and invalid.
3. The Next Page button is permanently `disabled={true}`, preventing reviewers from advancing pages manually.
4. If a reviewer clicks Previous to return to Page 1, they are permanently locked out of returning to Page 2 via toolbar buttons.
5. In `getAllBoundingBoxes()`, `boundaries` has hardcoded `pageNumber: 1`, even when `sched.evidenceAnchor?.pageNumber` is 2, creating inconsistent split-page behavior.
6. The canvas placeholder (`pdf-canvas-placeholder`, lines 504-540) has no visual indication of the current sheet (e.g. `Sheet 2 of 3`).

---

## 2. Logic Chain

1. **Security Impact of Prototype Pollution**:
   - `setNestedValue` splits path strings on dots (`.`) and iteratively accesses and creates sub-objects.
   - Without an explicit block list of special properties (`__proto__`, `constructor`, `prototype`), any authenticated user can mutate `Object.prototype` in the Node.js process.
   - In a multi-tenant application, modifying `Object.prototype` modifies property lookup for every tenant's request handlers, rate limiters, and authentication checks.
   - Therefore, `setNestedValue` and `getNestedValue` must validate each path segment against forbidden prototype keys. Furthermore, `PATCH /fields` must validate `fieldPath` and `overrides` keys at the API boundary and reject invalid keys with `400 Bad Request`.

2. **Security Impact of Path Traversal**:
   - File uploads in `server.ts:214` store files with `path.basename(file.path)` (UUID format).
   - If an attacker or corrupted database row provides a `storage_key` with directory traversal elements (`../`, `..\\`, absolute paths, or null bytes), `path.join(uploadDir, doc.storage_key)` escapes `uploadDir`.
   - The server must ensure that any file accessed via `storage_key` is strictly confined within `uploadDir` and is a regular file. Any attempt to traverse outside must be rejected with `403 Forbidden`.

3. **Usability and Correctness of Review UI**:
   - Real Karnataka title instruments (Sale Deeds, Khata, RTC, Mutation Extracts) span multiple pages (often 4 to 12 pages).
   - In `apps/api/src/document-extractor.ts`, `splitIntoPages` and `buildEvidenceAnchor` accurately assign `pageNumber` to each extracted anchor.
   - The UI must dynamically compute `totalPages` as the maximum of 1, the anchors' `pageNumber` attributes, and any explicit `pageCount` properties.
   - The Next and Previous buttons must be enabled/disabled according to `currentPage > 1` and `currentPage < totalPages`.
   - The document canvas must visually indicate the active sheet number, and `boundaries` must respect `sched.evidenceAnchor?.pageNumber`.

---

## 3. Caveats

- **Scope Boundary**: As an exploration agent (`explorer_m1_iter2_2`), this agent does not directly modify source code in `apps/api/src` or `apps/web/src`. An implementation worker must apply the exact diffs provided in this report.
- **Test Oracle Decoupling**: While this investigation focuses on `server.ts` and `SideBySideReview.tsx`, the implementation worker must also be aware that `apps/api/test/challenger-adversarial-server.test.ts` contains tests designed to verify that defects *existed*. Once the defects are fixed, those tests must be updated to assert security protection (exit code 0).
- **Environment**: File uploads are tested using local disk storage in `./uploads`. Cloud object storage is slated for later milestones.

---

## 4. Conclusion: Exact Remediation Plan

### Remediation Item 1: Prototype Pollution Guard in `apps/api/src/server.ts`

#### Step 1.1: Add Forbidden Key Constants & Helper Functions
In `apps/api/src/server.ts` (around lines 170–189):

```typescript
// Replace lines 171-188 with:

const FORBIDDEN_PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function isSafeFieldPath(pathStr: string): boolean {
  if (!pathStr || typeof pathStr !== 'string') return false;
  const parts = pathStr.split('.');
  return parts.every(part => {
    const trimmed = part.trim();
    return trimmed.length > 0 && !FORBIDDEN_PROTOTYPE_KEYS.has(trimmed);
  });
}

export function getNestedValue(obj: any, pathStr: string): any {
  if (!obj || typeof obj !== 'object' || !pathStr || typeof pathStr !== 'string') return undefined;
  const parts = pathStr.split('.');
  for (const part of parts) {
    if (FORBIDDEN_PROTOTYPE_KEYS.has(part.trim())) return undefined;
  }
  return parts.reduce((acc, part) => {
    const trimmed = part.trim();
    return acc && typeof acc === 'object' && !FORBIDDEN_PROTOTYPE_KEYS.has(trimmed) ? acc[trimmed] : undefined;
  }, obj);
}

export function setNestedValue(obj: any, pathStr: string, value: any): boolean {
  if (!obj || typeof obj !== 'object' || !pathStr || typeof pathStr !== 'string') return false;
  const parts = pathStr.split('.');
  for (const part of parts) {
    if (FORBIDDEN_PROTOTYPE_KEYS.has(part.trim())) {
      return false; // Safely abort without mutating
    }
  }
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i].trim();
    if (FORBIDDEN_PROTOTYPE_KEYS.has(part)) return false;
    if (!curr[part] || typeof curr[part] !== 'object' || Array.isArray(curr[part])) {
      curr[part] = {};
    }
    curr = curr[part];
  }
  const lastPart = parts[parts.length - 1].trim();
  if (FORBIDDEN_PROTOTYPE_KEYS.has(lastPart)) return false;
  curr[lastPart] = value;
  return true;
}
```

#### Step 1.2: Hardened Validation in `PATCH /api/properties/:id/documents/:docId/fields`
In `apps/api/src/server.ts` (around lines 333–370):

```typescript
  const { fieldPath, newValue, rationale, overrides } = req.body || {};
  if (!rationale && !overrides && !fieldPath && req.body?.isVerified === undefined) {
    return res.status(400).json({ error: 'Rationale and field updates are required for reviewer overrides.' });
  }

  // Prototype Pollution Guard: Reject dangerous field paths immediately
  if (fieldPath && !isSafeFieldPath(fieldPath)) {
    return res.status(400).json({ error: 'Invalid fieldPath: prototype properties (__proto__, constructor, prototype) are strictly forbidden.' });
  }

  if (overrides && typeof overrides === 'object') {
    for (const key of Object.keys(overrides)) {
      if (!isSafeFieldPath(key)) {
        return res.status(400).json({ error: `Invalid override key "${key}": prototype properties are strictly forbidden.` });
      }
    }
  }

  // Enforce mandatory non-empty review rationale when overriding fields
  if (fieldPath && (!rationale || typeof rationale !== 'string' || rationale.trim().length === 0)) {
    return res.status(400).json({ error: 'A non-empty review rationale is mandatory when overriding extracted document fields.' });
  }
```

---

### Remediation Item 2: Path Traversal Guard in `apps/api/src/server.ts`

#### Step 2.1: Add `resolveSafeUploadPath` Helper Function
In `apps/api/src/server.ts` (above route definitions):

```typescript
export function resolveSafeUploadPath(storageKey: string | null | undefined): { safePath: string | null; isTraversal: boolean } {
  if (!storageKey || typeof storageKey !== 'string') {
    return { safePath: null, isTraversal: false };
  }
  // Check for traversal tokens, slashes, or null bytes in standard single-file storage keys
  if (storageKey.includes('\0') || storageKey.includes('..') || storageKey.includes('/') || storageKey.includes('\\')) {
    return { safePath: null, isTraversal: true };
  }

  const normalizedUploadDir = path.resolve(uploadDir);
  const resolvedPath = path.resolve(normalizedUploadDir, storageKey);

  // Must reside strictly within normalizedUploadDir
  if (!resolvedPath.startsWith(normalizedUploadDir + path.sep)) {
    return { safePath: null, isTraversal: true };
  }

  // Relative path must not escape
  const relative = path.relative(normalizedUploadDir, resolvedPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return { safePath: null, isTraversal: true };
  }

  return { safePath: resolvedPath, isTraversal: false };
}
```

#### Step 2.2: Apply Guard to `GET /api/properties/:id/documents/:docId/file`
In `apps/api/src/server.ts:230-252`:

```typescript
app.get('/api/properties/:id/documents/:docId/file', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const docResult = await pool.query(
    'SELECT * FROM documents WHERE id=$1 AND property_id=$2 AND tenant_id=$3',
    [req.params.docId, req.params.id, req.user?.tenantId]
  );
  if (!docResult.rowCount) return res.status(404).json({ error: 'Document not found.' });
  const doc = docResult.rows[0];

  const { safePath, isTraversal } = resolveSafeUploadPath(doc.storage_key);
  if (isTraversal || !safePath) {
    return res.status(403).json({ error: 'Access denied: invalid file path traversal.' });
  }

  if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
    return res.status(404).json({ error: 'Document file not found on disk.' });
  }

  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_filename)}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  const stream = fs.createReadStream(safePath);
  stream.on('error', (err) => {
    console.error('File stream error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to stream document file.' });
  });
  stream.pipe(res);
}));
```

#### Step 2.3: Apply Guard to `POST /api/properties/:id/documents/:docId/extract`
In `apps/api/src/server.ts:254-272`:

```typescript
  const doc = docResult.rows[0];
  const { safePath, isTraversal } = resolveSafeUploadPath(doc.storage_key);

  let fileBuffer: Buffer | undefined;
  if (!isTraversal && safePath && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    try {
      fileBuffer = fs.readFileSync(safePath);
    } catch (e) {
      console.warn('Could not read file from storage:', e);
    }
  }
```

---

### Remediation Item 3: Multi-Page UI Pagination in `SideBySideReview.tsx`

#### Step 3.1: Fix Schedule Boundaries Page Number
In `apps/web/src/components/SideBySideReview.tsx:191-203`:

```tsx
      // Boundaries
      if (sched.boundaries?.north) {
        boxes.push({
          fieldId: 'boundaries',
          label: 'Schedule Boundaries',
          pageNumber: sched.evidenceAnchor?.pageNumber || 1, // FIXED: dynamically use schedule anchor pageNumber
          ymin: 0.62,
          xmin: 0.10,
          ymax: 0.74,
          xmax: 0.90,
          confidence: fields.fieldConfidence?.boundaries ?? 0.88,
          snippet: `N: ${sched.boundaries.north}, S: ${sched.boundaries.south}`,
        });
      }
```

#### Step 3.2: Dynamic `totalPages` Derivation & Bounds Protection
In `apps/web/src/components/SideBySideReview.tsx` (around lines 225–235):

```tsx
  const allBoxes = getAllBoundingBoxes();

  // Dynamically calculate total pages from all bounding box anchors and explicit page count
  const totalPages = useMemo(() => {
    if (!allBoxes.length) return 1;
    const pageNumbers = allBoxes.map((b) => b.pageNumber || 1);
    const maxAnchorPage = Math.max(1, ...pageNumbers);
    const explicitPageCount = (fields as any)?.pageCount || (doc as any)?.page_count || 1;
    return Math.max(1, maxAnchorPage, explicitPageCount);
  }, [allBoxes, fields, doc]);

  // Keep currentPage within valid bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const pageBoxes = allBoxes.filter((b) => b.pageNumber === currentPage);
```

#### Step 3.3: Enable Navigation Buttons and Show Correct Total Pages
In `apps/web/src/components/SideBySideReview.tsx:440-456`:

```tsx
            <div className="page-nav">
              <button
                className="icon-btn-small"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                title="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="page-indicator">Page {currentPage} of {totalPages}</span>
              <button
                className="icon-btn-small"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                title="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
```

#### Step 3.4: Multi-Page Canvas Rendering in `pdf-canvas-placeholder`
In `apps/web/src/components/SideBySideReview.tsx:504-540`:

```tsx
              ) : isPdf ? (
                <div className="pdf-canvas-placeholder">
                  <div className="legal-paper-header">
                    <div className="govt-seal">GOVERNMENT OF KARNATAKA</div>
                    <div className="dept-sub">{fields?.issuingAuthority || 'Department of Stamps and Registration'}</div>
                    <div className="doc-headline">
                      {prettyDocType(fields?.documentType || 'sale_deed').toUpperCase()}
                      {totalPages > 1 && <span className="sheet-badge"> — SHEET {currentPage} OF {totalPages}</span>}
                    </div>
                  </div>
                  <div className="legal-paper-body">
                    <div className="watermark-bg">
                      KARNATAKA JANA SEVA{totalPages > 1 ? ` • SHEET ${currentPage}` : ''}
                    </div>

                    {/* Sheet 1: Registration info & Parties */}
                    {(totalPages === 1 || currentPage === 1) && (
                      <>
                        <p className="doc-num-row"><strong>Registered Document No:</strong> {fields?.documentNumber || 'PENDING'}</p>
                        <div className="mock-parties-p">
                          <strong>VENDORS / EXECUTANTS:</strong>
                          {fields?.parties?.filter(p => p.role === 'seller' || p.role === 'donor' || p.role === 'owner').map((p, i) => (
                            <div key={i}>{p.name} {p.relationship ? `(${p.relationship})` : ''}</div>
                          )) || '—'}
                        </div>
                        <div className="mock-parties-p">
                          <strong>PURCHASERS / CLAIMANTS:</strong>
                          {fields?.parties?.filter(p => p.role === 'buyer' || p.role === 'donee').map((p, i) => (
                            <div key={i}>{p.name} {p.relationship ? `(${p.relationship})` : ''}</div>
                          )) || '—'}
                        </div>
                      </>
                    )}

                    {/* Sheet 2 (or Page 1 if single page): Property Schedule & Boundaries */}
                    {(totalPages === 1 || currentPage === 2) && (
                      <>
                        <p className="schedule-p">
                          <strong>SCHEDULE PROPERTY:</strong> All that piece and parcel of immovable agricultural / converted land bearing Survey No. {fields?.propertySchedule?.surveyNumber || '—'} situated at {fields?.propertySchedule?.village || '—'}, {fields?.propertySchedule?.district || 'Bengaluru Urban'}, measuring {fields?.propertySchedule?.extent?.rawText || '—'} ({fields?.propertySchedule?.extent?.normalizedSqFt?.toLocaleString('en-IN') || '—'} Sq. Ft.).
                        </p>
                        <div className="mock-boundaries-grid">
                          <div><strong>North:</strong> {fields?.propertySchedule?.boundaries?.north || '—'}</div>
                          <div><strong>South:</strong> {fields?.propertySchedule?.boundaries?.south || '—'}</div>
                          <div><strong>East:</strong> {fields?.propertySchedule?.boundaries?.east || '—'}</div>
                          <div><strong>West:</strong> {fields?.propertySchedule?.boundaries?.west || '—'}</div>
                        </div>
                      </>
                    )}

                    {/* Sheet 3+ (or Sheet 2 if 2 pages total, or Sheet 1 if single page): Consideration & Endorsements */}
                    {(totalPages === 1 || (totalPages === 2 && currentPage === 2) || currentPage >= 3) && fields?.consideration && (
                      <div className="mock-consideration">
                        <strong>Total Consideration Amount:</strong> ₹ {fields.consideration.amount.toLocaleString('en-IN')}
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                          Registered at {fields.subRegistrarOffice || 'Sub-Registrar Office'} • Official Stamp Verified
                        </div>
                      </div>
                    )}
                  </div>
                </div>
```

---

### Remediation Item 4: Updating `challenger-adversarial-server.test.ts`
When the security fixes are implemented in `server.ts`, the tests in `apps/api/test/challenger-adversarial-server.test.ts` must be updated to assert the fixed, secure behavior:

1. **Path Traversal Test** (`lines 16–54`):
```typescript
test('CHALLENGER SECURITY: Path Traversal in GET /api/properties/:id/documents/:docId/file is strictly blocked', async () => {
  // Setup document with traversal storage_key '../package.json'
  ...
  try {
    const streamRes = await fetch(`${serverBaseUrl}/api/properties/22222222-2222-4222-8222-222222222222/documents/${docId}/file`);
    const body = await streamRes.text();

    assert.equal(streamRes.status, 403, 'Path traversal must return 403 Forbidden');
    assert.ok(!body.includes('@ojix/property-api'), 'Must not stream files outside uploadDir');
  } finally {
    await pool.query('DELETE FROM documents WHERE id=$1', [docId]);
  }
});
```

2. **Prototype Pollution Test** (`lines 156–177`):
```typescript
test('CHALLENGER SECURITY: Prototype Pollution blocked in setNestedValue', () => {
  const target: any = {};
  setNestedValue(target, '__proto__.challengerPollutionFlag', 'compromised');
  setNestedValue(target, 'constructor.prototype.challengerPollutionFlag2', 'compromised');

  const cleanObject: any = {};
  assert.equal(cleanObject.challengerPollutionFlag, undefined, 'Prototype pollution was blocked');
  assert.equal(cleanObject.challengerPollutionFlag2, undefined, 'Constructor prototype pollution was blocked');
  assert.equal((Object.prototype as any).challengerPollutionFlag, undefined);
});
```

3. **Mandatory Rationale Test** (`lines 64–112`):
```typescript
test('CHALLENGER SECURITY: PATCH /fields rejects missing or whitespace rationale with 400', async () => {
  ...
  const patchRes = await fetch(`${serverBaseUrl}/api/properties/.../documents/${docId}/fields`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fieldPath: 'documentNumber', newValue: 'OVERRIDDEN' }),
  });
  assert.equal(patchRes.status, 400, 'Must reject missing rationale with 400 Bad Request');
});
```

---

## 5. Verification Method

To independently verify the implementation after applying this plan:

1. **Verify Prototype Pollution Fix in Node.js**:
   ```bash
   node -e "
   import('./apps/api/src/server.js').then(m => {
     const obj = {};
     m.setNestedValue(obj, '__proto__.polluted', true);
     console.assert(({}).polluted === undefined, 'FAILED: Prototype polluted!');
     console.log('PASS: Prototype pollution blocked.');
   });
   "
   ```

2. **Verify Path Traversal Guard in Node.js**:
   ```bash
   node -e "
   import('./apps/api/src/server.js').then(m => {
     const res1 = m.resolveSafeUploadPath('../package.json');
     console.assert(res1.isTraversal === true, 'FAILED: Relative traversal not flagged!');
     const res2 = m.resolveSafeUploadPath('/etc/passwd');
     console.assert(res2.isTraversal === true, 'FAILED: Absolute traversal not flagged!');
     const res3 = m.resolveSafeUploadPath('valid-uuid-file.pdf');
     console.assert(res3.isTraversal === false && res3.safePath !== null, 'FAILED: Valid filename rejected!');
     console.log('PASS: Path traversal guard verified.');
   });
   "
   ```

3. **Verify Typecheck and Build**:
   ```bash
   npm run typecheck
   npm run build
   ```
   Both must exit with code 0.

4. **Run Server Adversarial Suite**:
   ```bash
   npx tsx --test apps/api/test/challenger-adversarial-server.test.ts
   ```
   Must pass 100% of tests with exit code 0.

5. **Run Full Test Suite**:
   ```bash
   npm test
   ```
   Must pass 100% of tests with exit code 0.
