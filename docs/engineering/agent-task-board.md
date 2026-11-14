# OJIX Engineering — Specialist Task Board

| Task ID | Specialist Workstream | Scope / Files | State | Blockers / Notes |
| :--- | :--- | :--- | :--- | :--- |
| ST-01 | Architecture / DevOps | `apps/api/package.json` dev script fix | **Done** | Fixed `tsx watch` hang using native Node `--import tsx --watch`. |
| ST-02 | Backend / Domain | `server.ts` Owner invariant & Legal separation | **Done** | Enforced sole owner protection & advocate sign-off separation. |
| ST-03 | Frontend / UX | `LoginPage.tsx` & `SettingsView.tsx` | **Done** | Credential prefill & MFA toggle wired. |
| ST-04 | Security / RBAC | P1: Ownership Transfer Flow | **Pending** | Needs `POST /api/admin/ownership/transfer` & UI modal. |
| ST-05 | Security / RBAC | P2: `ownerGuard` Middleware Separation | **Pending** | Needs dedicated middleware isolating Owner privileges from Admin. |
| ST-06 | Product / Domain | P3: Client Report Release Gate | **Pending** | Needs explicit release authorization & client share tokens. |
| ST-07 | Architecture / Data | P4: Matter Workspace Lifecycle (MAT-01) | **Pending** | Schema migration `matters` table & property association. |
| ST-08 | Product / Admin | P5: Plans & Billing Quota Governance | **Pending** | Quota counters & billing management view. |
| ST-09 | AI / Governance | P6: AI Model Gateway Config | **Pending** | Provider selection & prompt template versioning. |
| ST-10 | Data / Security | P7: Retention Purge & Legal Hold Engine | **Pending** | Automated purge job with legal hold override. |
| ST-11 | Frontend / UX | P8: Partner Executive Dashboard | **Pending** | Pipeline throughput & team bottleneck analytics. |

