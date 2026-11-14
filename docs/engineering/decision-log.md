# OJIX Engineering — Decision Log

| Date | ID | Context / Problem | Decision | Consequence / Trade-offs |
| :--- | :--- | :--- | :--- | :--- |
| 2026-11-05 | DEC-01 | `tsx watch` hangs on Windows inside OneDrive directory | Switched backend dev runner to native `node --import tsx --watch src/server.ts` | Resolves file watcher stall without losing hot reloading; boots API in < 2 seconds. |
| 2026-11-05 | DEC-02 | Legal sign-off vs. Administrative governance separation | Enforce LAW-01 in `properties` table (`legal_approved_by_uid`, migration 031) | Workspace Owner governs tenant and workflow, but only qualified Lead Advocate (`lawyer`) can certify legal title reports. |
| 2026-11-05 | DEC-03 | Protected Sole Owner Invariant (FRD §14 / §20 / ADM-03) | Enforce at API middleware and SQL layer that sole active owner cannot be removed, disabled, or demoted | Tenant cannot be left ownerless; ownership transfer requires designated handover protocol. |
| 2026-11-05 | DEC-04 | Privileged MFA Enforcement Toggle (AUTH-01) | Add `enforce_mfa_privileged` to `workspace_settings` table | When enabled, all active staff roles require 6-digit email OTP; when disabled in local development, direct password login is permitted. |

