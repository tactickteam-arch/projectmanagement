# Sangeetha Mobiles – Store Launch Tracker

Tracks every new store from location filing to soft launch. Store owners and Sangeetha's departments each update their own steps; approvers sign off in the app; HQ sees status, delays and costs for every store on one dashboard.

Spec: *Store Launch Tracker: Project Spec* (11 Nov 2026), with the step flow replaced by the *New outlet launch: user flow* diagram (17 Nov 2026). Undecided points: [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## The launch flow

| Step | Done by | Filled in by | Approved by |
|---|---|---|---|
| 1 · Location filing | Store owner | Store owner | Boss + CEO |
| 2 · 8-point landlord check | Sangeetha | Accounts, State admin | RK ("all 8 points cleared") |
| 3 · Token advance | Sangeetha | Accounts, Legal | Accounts. After approval, Purchase or Accounts records the APX PO number |
| 4 · Legal agreement and statutory | Sangeetha | Legal, Tax team, Accounts | None: marked green when done. Starts after step 2 and runs alongside steps 3–5 |
| 5 · Key received | Both | Store owner, State admin | RK ("handover accepted") |
| 6 · Store setup: 8 tracks in parallel | Sangeetha | Marketing, Interiors, Brand promoters, HR, Stocks, Finance and IT, Trade licence, Launch planning | None: each department marks its own track green |
| 7 · Soft launch | | Store owner or HQ enters the date once all departments are green | |

- A step can't start until the step before it is approved.
- A step can't be completed until its points are ticked, its required fields are filled and its photos are uploaded.
- When RK accepts the handover, the handover date becomes Day 0. The 8 tracks are scheduled from it and every department is notified.
- Who fills in or approves each step, the schedule and the checklist items can all be changed in **Settings**.
- Step definitions live in `src/modules/*.ts`.

## Run locally

Needs Node.js 20+.

```bash
npm install            # also generates the Prisma client
cp .env.example .env   # fill in database URLs and SESSION_SECRET (32+ random chars)
npm run db:migrate     # create tables
npm run db:sync-steps  # write the 13 launch steps into module_templates and give every store all steps
npm run db:seed        # demo data (8 fictional stores, 18 demo users) — runs the step sync itself
npm run dev            # http://localhost:3000
```

Production mode: `npm run build && npm start`. To sign in from a phone on the same Wi-Fi over plain http, set `COOKIE_SECURE=false`. For a local Postgres without TLS, set `DATABASE_SSL=disable` (Supabase always uses verified TLS).

**Upgrading an existing database to the launch flow:**
1. Run `npm run db:migrate`. This adds teams, `edit_teams` and `approver_team`, and renames Store Location to Location filing.
2. Run `npm run db:sync-steps`. This adds the new steps to every store, retires the old module types and recomputes statuses.
3. Existing stores move to the new steps. New steps start as Not Started, so many stores show an earlier status than before. A store that already had keys keeps them: its handover counts as accepted and its department tracks are scheduled from that date.

## Demo accounts (development only)

Password for all: **`Demo@2026`** (`SEED_PASSWORD` in `.env`). All data is fictional and labelled "Demo".

| Role | E-mail | Sees |
|---|---|---|
| SuperAdmin (HQ) | hq.admin@sangeetha.test | All stores |
| Regional Manager | rm.south@sangeetha.test | KA, KL, TN, TG |
| Store owner | owner.arjun@sangeetha.test | Jayanagar (store setup: rejected, blocked, overdue), Edappally (landlord check sent back by RK), Gomti Nagar (waiting for Boss + CEO) |
| Store owner | owner.meera@sangeetha.test | T. Nagar (token advance waiting for Accounts), Kukatpally (all departments green) |
| Store owner | owner.rahul@sangeetha.test | Kothrud (soft launched), Vastrapur (key handover waiting for RK; APX PO not yet recorded) |
| Store owner | owner.fatima@sangeetha.test | Salt Lake (keys received) |

Sangeetha team members (role "Sangeetha team") see all stores. Each one edits and approves only the steps that belong to their teams:

| Team | E-mail |
|---|---|
| Boss + CEO (approves location filing) | leadership@sangeetha.test |
| RK (approves landlord check and key handover) | rk@sangeetha.test |
| Accounts | accounts@sangeetha.test |
| Legal and Tax team | legal@sangeetha.test |
| State admin | stateadmin@sangeetha.test |
| Marketing | marketing@sangeetha.test |
| Interiors | interiors@sangeetha.test |
| Brand managers | brands@sangeetha.test |
| HR | hr@sangeetha.test |
| Purchase · e-com | purchase@sangeetha.test |
| Consumer finance · IT · Admin | finance.it@sangeetha.test |
| Sales heads (SH · SL) | sales@sangeetha.test |

Re-running `npm run db:seed` resets the demo data.

## Features

**Built and tested**
- Login (e-mail + password, bcrypt, 8-hour JWT cookie), 4 roles (HQ, Regional Manager, Store owner, Sangeetha team) plus teams; access is checked on every API call and page
- **Launch flow page per store.** It mirrors the diagram: who does each step, its points and owners, the approver, the system actions (APX PO, notifying departments), a lock until the previous step is done, and the step-6 track grid
- **My tasks** for team members: what to do now, what has been sent for approval, what is coming up
- **Approvals queue:** each approver team sees only its own steps
- **Store owner (mobile-first):** My stores, Add store with map pin picker, step forms (points, config-driven fields, checklists), camera/photo/PDF upload, save draft / mark Completed, comments
- **HQ (desktop-first):** dashboard cards, store × step grid (steps 1–5, the step-6 tracks, soft launch), filters, approve / send back with comment, status override (On Hold / Dropped), delays report, cost report with chart, map view
- **Settings:** users and teams, who fills in and approves each step, store assignment, scheduling defaults, checklist items
- All spec validation rules, overall status rules, progress, overdue, days since handover
- Activity log, in-app notifications (incl. daily overdue check), Excel export (store list, delays, costs)
- Uploaded files stored on local disk, served only after an access check

**Deferred**
- PDF export, e-mail/WhatsApp notifications, phone OTP (paid SMS), offline/PWA
- Editing module field definitions in the UI (fields are config files: `src/modules/*.ts`)
- Cloud file storage (the `StorageDriver` interface in `src/lib/storage.ts` is ready for S3/Supabase Storage)

**Known limitations**
- The database is Supabase Seoul; pages take about 1–2 s from India. The pooler sometimes drops idle connections; queries now time out after 20 s instead of hanging, and a reload fixes it.
- The daily overdue check runs on the first page load of the day (no scheduler locally).
- Demo photos are generated images labelled "Sample photo".

## Checks

```bash
npm test          # 50 unit tests (status rules, step rules, scheduling, access, store codes)
npm run typecheck
npm run lint
```

End-to-end, 135 checks ran over the real API and a local database, and all passed (17 Nov). They walked a new store through all 7 steps, each as the right person. They also checked:
- that the wrong person is refused at every step;
- prerequisites;
- the points, checklist and photo rules;
- send-back and re-submission;
- the APX PO;
- that accepting the handover schedules the tracks and notifies every department;
- that the approvals queue sends each team only its own steps;
- every page for every role, the exports and Settings.

## Layout

```
prisma/          schema, migrations, seed
src/app/         pages ((app)/hq, owner, stores, notifications) and API routes (api/)
src/modules/     one config file per launch step (who does it, approver, points, fields, offsets, photo minimums)
src/lib/         auth, services (business rules), queries, storage, scheduling, status
src/components/  UI (shadcn/ui)
tests/           unit tests
```
