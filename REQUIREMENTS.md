# Requirements Tracker — Sangeetha Mobiles Store Launch Tracker

**Source of truth:** *Sangeetha Mobiles – Store Launch Tracker: Project Spec* (11 Nov 2026, PDF).
It **replaces** the earlier *New Store Setup Management System* spec (10 Nov) and all decisions made against it (owner decision, 11 Nov 2026).

Labels: **CONFIRMED** (spec or owner decision) · **PROPOSED** (needs approval) · **OPEN** (question outstanding).
Last updated: 17 Nov 2026

---

## Decision log

| # | Date | Decision |
|---|---|---|
| D1 | 11 Nov | New PDF spec replaces the old spec and earlier decisions (incl. "no delays" — overdue tracking is back as per spec). |
| D2 | 11 Nov | Login: **e-mail + password** now; phone OTP later (needs an SMS provider account). |
| D3 | 11 Nov | Database: the existing Supabase project (ieirkeldjwmfgydtaamr, Seoul region). Mumbai not required by the new spec. |
| D4 | 11 Nov | Regional Manager role included in the schema now; who may approve is still open (Q3). |
| D5 | 11 Nov | Prisma 7.10.1 (latest stable; 8.0 is a release candidate), Next.js 16.4.3, custom JWT sessions as per spec. |
| D6 | 17 Nov | The *New outlet launch: user flow* diagram replaces the spec's 7 modules + Key Handover. There are now 13 steps: 1 Location filing, 2 8-point landlord check, 3 Token advance (+ APX PO), 4 Legal agreement and statutory, 5 Key received, 6 eight parallel department tracks, then 7 Soft launch. Each step has teams that fill it in and an optional approver team (Boss + CEO, RK, Accounts). New role "Sangeetha team" with teams. The open points are in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) #1–17. |

---

## Launch flow (17 Nov) — implemented and tested

| Item | Where | Tested how |
|---|---|---|
| 13 steps as config: who does each step, the teams that fill it in, approver team, points and owners, prerequisites, system actions | `src/modules/*.ts`, `src/lib/teams.ts` | Unit tests; E2E |
| Teams on users, the "Sangeetha team" role, and permissions per step (fill in / approve) | `src/lib/auth/permissions.ts`, migration `20261117000000_launch_flow` | Unit tests; E2E: wrong team gets 403 at every step |
| Prerequisites, points/checklist/required-field/photo rules on completion | `src/lib/module-rules.ts` | Unit tests; E2E |
| Steps without an approver go green when done; send-back returns the step to In Progress with a comment | `src/lib/services/modules.ts` | E2E |
| APX PO number recorded after Token advance approval | `api/modules/:id/after-approval` | E2E |
| RK accepting the handover sets Day 0, schedules the 8 tracks and notifies every department | `afterStepDone` in `src/lib/services/modules.ts` | E2E |
| Launch flow page, My tasks, approvals queue per team, store × step grid, Settings (teams, steps & approvals, checklists) | `src/components/launch-flow.tsx`, `src/app/(app)/tasks`, `hq/approvals`, `hq/settings` | E2E: every page for every role |
| Upgrade of existing data (`npm run db:sync-steps`) | `src/lib/steps-sync.ts` | Ran on a copy of the old demo database: old stores got the new steps, recorded handovers kept |

The phase tables below describe the original 11 Nov build. Where they mention modules, read "steps" (D6).

---

## Build phases (spec) and status

| Phase | Scope | Status |
|---|---|---|
| **1 — Foundation** | Project setup, schema, migrations, seed data, login with roles | **Done, tested** (see below) |
| 2 — Store owner flow | Add store, store detail, 8 module forms, photo uploads, key handover auto-scheduling | Not started |
| 3 — HQ dashboard | Summary cards, store × module grid, filters, HQ store detail with approve/reject, approvals queue | Not started |
| 4 — Tracking | Overdue checks, in-app notifications, comments, activity log | Not started |
| 5 — Reports & polish | Map view, delays & cost reports, Excel/PDF export, module template settings | Not started |
| 6 — Later | WhatsApp & e-mail notifications, offline PWA | Not started |

---

## Phase 1 — implemented and tested

| Item | Spec reference | Where | Tested how |
|---|---|---|---|
| Next.js + TypeScript + Tailwind project | Tech stack | repo root | `npm run build`, `tsc`, `eslint` clean |
| 8 tables per spec (users, stores, module_templates, store_modules, attachments, comments, notifications, activity_log) | Database tables | `prisma/schema.prisma`, `prisma/migrations/` | Applied to Supabase with `prisma migrate deploy` |
| One config file per module (8), seeded into `module_templates.field_schema` | Instruction 3 | `src/modules/*.ts` | Unit tests: 8 modules, unique keys, photo minimums 1/2/4 |
| Seed: 5 sample stores in 5 states, 5 stages; 5 sample users across 3 roles | Instruction 4 | `prisma/seed.ts` | Ran against DB; statuses derived by the rules, not hand-set |
| Overall status rules, progress %, overdue rule | Overall status rules, Computed values | `src/lib/status.ts` | 11 unit tests |
| Auto-scheduling from key handover (offsets + target launch 30) | Auto-scheduling | `src/lib/scheduling.ts` | Unit tests against spec table |
| Login (e-mail + password, bcrypt, JWT cookie 8 h, HttpOnly/Secure/SameSite) | Users and roles, Auth | `src/app/api/auth/*`, `src/lib/auth/*` | End-to-end against running server |
| Role scope on every API call: SuperAdmin all; Regional Manager own states; Store Owner own stores | Users and roles | `src/lib/auth/access.ts`, `src/lib/stores.ts` | E2E: each of 5 users sees exactly the expected stores via API and page; RM cannot widen scope via filters |
| `GET /api/stores` with state/city/status filters | API endpoints | `src/app/api/stores/route.ts` | E2E incl. invalid filter → 400 |
| Deactivated user is signed out immediately | Users and roles (is_active) | `src/lib/auth/dal.ts` | E2E: existing session → 401, new login → 401 |
| Database TLS verified against Supabase root CA | Security | `src/lib/db-ca.ts`, `prisma.config.ts` | Wrong CA rejected, correct CA accepted |
| Supabase public Data API locked out of all tables | Security (not in spec — required by Supabase hosting) | `prisma/migrations/…_lock_down_supabase_api` | Public REST with publishable key → 401 on all tables (was 200 before) |
| Minimal signed-in landing pages (HQ table, owner cards) | Phase 1 "login with roles" | `src/app/hq`, `src/app/owner` | Rendered with real data in E2E |

### Known behaviour / limitations

- Opening the other role's page (e.g. a Store Owner opening `/hq`) returns HTTP 200 with a streamed redirect, not a 307, because pages stream (Next.js Cache Components). Verified that **no store data or other users' details** are in that response; the API returns proper 401/403.
- Seeded "Completed" modules have **no photos** (file storage arrives in Phase 2). The photo rule will be enforced by the API, not the seed.
- UI pages were checked by fetching their HTML, not yet by eye in a browser.
- Phone OTP not implemented (D2).

---

## Open questions

### From the spec's own list
| # | Question | Blocks |
|---|---|---|
| Q1 | "Token Advance" appeared twice in the original module list — is the second a different module (e.g. Rent Agreement / Security Deposit)? | Module list |
| Q2 | Is External Signage confirmed as a module? | Module list |
| Q3 | Who approves modules: only HQ owner, or also Regional Managers (for their region)? | Phase 3 |
| Q4 | Default day offsets after key handover (current values are placeholders). | Phase 2 |
| Q5 | Login: phone OTP later — which SMS provider (e.g. MSG91)? Needs DLT registration. | Phase 6 |
| Q6 | Hosting: Sangeetha's own servers or cloud? (Currently Supabase, Seoul region.) | Deployment |

### Found while building Phase 1
| # | Question | Current interim handling |
|---|---|---|
| Q-STATUS-NEW | What is a store's overall status before Store Location is approved? The spec's first status is "Location Finalised". | Status left empty, shown as "Not yet finalised". |
| Q-KEY-HANDOVER-COUNT | Key Handover is "a milestone, not a full module" — does it count in the 8 modules for progress % and "all modules approved"? Does HQ approve it? | Counted as one of the 8 store modules. |
| Q-FITOUT-STARTED | "Fit-out in progress: any fit-out module started" — does a module set to Blocked (never started) count? | Any status other than Not Started counts. |
| Q-PLANNED-END | Planned end = planned start + duration days? (e.g. Electrical: start Day 0, 10 days → end Day 10) | Yes, start + duration. |
| Q-STORE-CODE | Store code SGM-<STATE>-<CITY>-<NNNN>: (a) state codes — ISO (Telangana "TG") or vehicle style ("TS")? (b) city codes (BLR, CHE…) — who maintains the list? (c) is NNNN one running number overall, per state, or per city? | ISO codes; seed uses one running number. Generator not built yet (Phase 2). |
| Q-REQUIRED-FIELDS | Which module-specific fields are mandatory before "Completed"? The spec only gives the photo minimums and blocker reason. | No module-specific field is mandatory yet. |
| Q-HQ-FIELDS | "Location approved by HQ (Yes/No)" (Module 1) and "Design approved by HQ (Yes/No)" (Module 4) sit inside the owner's form. Are they filled by HQ, and how do they relate to the module's HQ approval? | Stored as plain fields for now. |
| Q-STORE-CREATE | Store Owners can create stores (spec). Is the creator automatically the store's owner, and can HQ reassign? | Not built yet (Phase 2). |
| Q-SESSION-LENGTH | How long should a login last? | 8 hours. |
| Q-ACCOUNTS | How are new users given their first password (HQ sets it? e-mail invite?) and how is a forgotten password reset? | Not built yet. |
| Q-COMPETITORS | List of competitor names for "nearby competitors" multi-select? | Free text only. |

---

## Proposed (needs approval)

| # | Proposal |
|---|---|
| P1 | Login rate limiting (e.g. lock after repeated failed attempts) — not in spec, recommended. |
| P2 | Store photos/documents in Supabase Storage (spec suggests S3 or Cloudinary; Supabase Storage is S3-compatible and already in the project). |
| P3 | Supabase Seoul → consider a Mumbai project before real data goes in (latency for users in India; data residency). |
