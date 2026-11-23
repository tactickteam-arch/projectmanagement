# Sangeetha Mobiles – Store Launch Tracker

Tracks every new store from location filing to soft launch. Store owners and Sangeetha's departments each update their own steps; approvers sign off in the app; HQ sees status, delays and costs for every store on one dashboard.

Source of truth: **`Sangeetha_New_Outlet_Launch_SOP_v2.pptx`** (New Outlet Launch SOP v2, 11 slides). Points the slides leave open: [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## The SOP flow (21 steps)

| Stage | Step | Filled in by | Approved by |
|---|---|---|---|
| 1 | Location filing: site proposal + 41-point MOU sheet | Store owner, ASM, SH, BH, State Admin | Boss + CEO. On approval every internal team is informed |
| 2 | 8-point landlord check (commercial terms, 3-phase kW load, 8 civil points, landlord's written confirmation) | State Admin, ASM, Accounts | RK ("all 8 points cleared") |
| 3 | Token advance + MOU | Legal, BH, State Admin, HO | Accounts. Then HO records the payment (the step turns green) and Accounts / Purchase record the APX PO |
| 4 | Legal & statutory: agreement, S&E, trade, labour, GST, balance deposit | Legal, Tax team, HO | None. Runs alongside stages 3–5; done after the keys |
| Q | Interiors vendor quotation (weeks 1–2) | Interiors, State Admin | Boss + CEO |
| 6·1 | External sign board (T-7) | Marketing, State Admin | None |
| T-7 | Advance material ordering | Interiors, State Admin, Marketing, IT/Admin | None |
| 5 | Key handover: 8-point audit, T-7 rule | State Admin + store owner | RK. Acceptance = Day 0; every Stage 6 team is told to start |
| 6·2–6·5 | On site, strict order: furniture → electrical & IT cabling → AC → in-shop branding | Interiors, State Admin, IT/Admin, Marketing | None |
| 6 | 8 department tracks: Marketing, Interiors, Brand promoters, HR, Stocks, Finance & IT, Trade licence, Launch planning | Each department | None: each marks its own track green |
| 7 | Soft launch: readiness audit + launch | State Admin, ASM | Gate: all 8 departments green |

Checked automatically (a failing check blocks completion and approval):
- **Slide 4:** 3-phase power only; sanctioned kW by store size (≤500 sq ft 7.5 kW … ≤3,000 sq ft 30 kW).
- **Slide 6, T-7:** no key handover unless the sign board and material ordering were finished at least 7 days before it.
- **Slide 8:** split AC below 1,000 sq ft, cassette from 1,000; at least 1 ton per 150 sq ft.
- **Slides 3/5:** every mandatory MOU point filled, PAN / IFSC / GSTIN / account / phone formats, required documents uploaded; landlord KYC hidden from teams that don't need it (Aadhaar: last 4 digits only).
- **Slide 10/11:** the 13-week schedule; daily delay alerts, a T-7 alert one week before the expected keys, and the weekly RAG report every Monday.

Step definitions live in `src/modules/*.ts`; the SOP rules in `src/lib/sop-rules.ts`.

## Run locally

Needs Node.js 20+.

```bash
npm install            # also generates the Prisma client
cp .env.example .env   # fill in database URLs and SESSION_SECRET (32+ random chars)
npm run db:migrate     # create tables
npm run db:sync-steps  # write the 21 SOP steps into module_templates and give every store all steps
npm run db:seed        # demo data (9 fictional stores, 23 demo users) — runs the step sync itself
npm run dev            # http://localhost:3000
```

Production mode: `npm run build && npm start`. To sign in from a phone on the same Wi-Fi over plain http, set `COOKIE_SECURE=false`. For a local Postgres without TLS, set `DATABASE_SSL=disable` (Supabase always uses verified TLS).

**Upgrading an existing database to SOP v2:** run `npm run db:migrate` (adds the expected key date) and then `npm run db:sync-steps` (adds the new steps to every store and retires the old ones).

**Earlier upgrade to the launch flow (17 Nov):**
1. Run `npm run db:migrate`. This adds teams, `edit_teams` and `approver_team`, and renames Store Location to Location filing.
2. Run `npm run db:sync-steps`. This adds the new steps to every store, retires the old module types and recomputes statuses.
3. Existing stores move to the new steps. New steps start as Not Started, so many stores show an earlier status than before. A store that already had keys keeps them: its handover counts as accepted and its department tracks are scheduled from that date.

## Demo accounts (development only)

Password for all: **`Demo@2026`** (`SEED_PASSWORD` in `.env`). All data is fictional and labelled "Demo".

| Role | E-mail | Sees |
|---|---|---|
| SuperAdmin (HQ) | hq.admin@sangeetha.test | All stores |
| Regional Manager | rm.south@sangeetha.test | KA, KL, TN, TG |
| Store owner | owner.arjun@sangeetha.test | Jayanagar (store setup: blocked HR, AC in progress), Edappally (landlord check sent back by RK; quotation overdue), Gomti Nagar (waiting for Boss + CEO) |
| Store owner | owner.meera@sangeetha.test | T. Nagar (token advance waiting for Accounts), Kukatpally (all departments green), Anna Nagar (keys in 6 days, HO payment not recorded, T-7 at risk) |
| Store owner | owner.rahul@sangeetha.test | Kothrud (soft launched), Vastrapur (key handover waiting for RK) |
| Store owner | owner.fatima@sangeetha.test | Salt Lake (keys received yesterday) |

Sangeetha team members (role "Sangeetha team") see all stores. Each one edits and approves only the steps that belong to their teams:

| Team | E-mail |
|---|---|
| Boss + CEO | leadership@sangeetha.test |
| RK (also creates stores) | rk@sangeetha.test |
| Accounts | accounts@sangeetha.test |
| Head office (HO) | ho@sangeetha.test |
| Legal and Tax team | legal@sangeetha.test |
| State Admin | stateadmin@sangeetha.test |
| ASM | asm@sangeetha.test |
| Business head (BH) | bh@sangeetha.test |
| Sales head (SH · SL) | sales@sangeetha.test |
| Marketing | marketing@sangeetha.test |
| Interiors | interiors@sangeetha.test |
| Brand managers | brands@sangeetha.test |
| HR | hr@sangeetha.test |
| Purchase · e-Com (CXO) | purchase@sangeetha.test |
| Consumer finance · IT · Admin | finance.it@sangeetha.test |
| Manjunath J (creates stores, posts daily site photos) | manju@sangeetha.test |
| Sumanth (approves final designs) | sumanth@sangeetha.test |

Re-running `npm run db:seed` resets the demo data.

## Features

**Built and tested**
- Login: e-mail + password until e-mail sending is set up; then a 6-digit code by e-mail only (10 minutes, 5 tries, one use). 8-hour JWT cookie, 4 roles (HQ, Regional Manager, Store owner, Sangeetha team) plus teams; access is checked on every API call and page
- **SOP flow page per store.** It mirrors the slides: stages 1–7, the T-7 panel, on-site order, the 8 department tracks and the all-green gate, with who does each step, the approver and what each step waits for
- **Weekly RAG** report (slide 11) with Excel export; store × stage grid on the dashboard
- **My tasks** for team members: what to do now, what has been sent for approval, what is coming up
- **Approvals queue:** each approver team sees only its own steps
- **Store owner (mobile-first):** My stores, Add store with map pin picker, step forms (points, config-driven fields, checklists), camera/photo/PDF upload, save draft / mark Completed, comments
- **HQ (desktop-first):** dashboard cards, store × step grid (steps 1–5, the step-6 tracks, soft launch), filters, approve / send back with comment, status override (On Hold / Dropped), delays report, cost report with chart, map view
- **Settings:** users and teams, who fills in and approves each step, store assignment, scheduling defaults
- All spec validation rules, overall status rules, progress, overdue, days since handover
- Activity log, in-app notifications (incl. daily overdue check), Excel export (store list, delays, costs)
- **Snags** tab: log a defect with photo or video, assign a department and fix-by date; fixed with an after photo/video; closed or sent back by whoever logged it, RK or HQ. Soft launch waits for every snag; late snags alert daily
- **Site photos** tab: from the keys to launch, Manju (right "Posts daily site photos") and each department post the day's photos; a store with none the day before is flagged
- **Design versions**: store layout and sign board keep every version; the design approver (Sumanth) approves the final one, which locks it
- **Timeline**: all 21 steps, planned vs actual, with today, keys and target launch
- Interiors cost vs the approved quotation; RK is alerted the first time it goes over
- E-mail copy of every alert (Resend), once `RESEND_API_KEY` and `EMAIL_FROM` are set
- Add to Home screen (web app manifest and icons)
- Uploaded files stored in the database (table `file_blobs`, works on Vercel), served only after an access check

**Deferred**
- PDF export, WhatsApp notifications (to be confirmed), offline use, vendor logins (not needed)
- Videos over about 4 MB (Vercel's request limit; needs Vercel Blob)
- Editing module field definitions in the UI (fields are config files: `src/modules/*.ts`)
- Cloud file storage (the `StorageDriver` interface in `src/lib/storage.ts` is ready for S3/Supabase Storage)

**Known limitations**
- The database is Supabase Seoul; pages take about 1–2 s from India. The pooler sometimes drops idle connections; queries now time out after 20 s instead of hanging, and a reload fixes it.
- The daily overdue check runs on the first page load of the day (no scheduler locally).
- Demo photos are generated images labelled "Sample photo".

## Checks

```bash
npm test          # 86 unit tests (SOP rules, status, step rules, scheduling, access, store codes)
npm run typecheck
npm run lint
```

End-to-end on 21 Nov: 382 checks over the real API and a local database, all passed. A new 1,200 sq ft store went through all 21 steps, each done by the right partner (store owner, ASM, State Admin, Boss + CEO, RK, Legal, Accounts, HO, Purchase, Marketing, Interiors, IT/Admin, Brand managers, HR, Sales). The checks covered:
- the wrong person refused at every step, and steps locked until the earlier ones are done;
- single-phase / too-low power, wrong AC type or tonnage, the T-7 rule, missing points and documents, bad PAN / IFSC;
- KYC hidden from Marketing but shown to Accounts;
- send-back and re-submission, HO's payment gate and the APX PO;
- Day 0 planning and the notices to every department; the soft launch;
- each approver's queue, every page for every partner, the four Excel exports, the weekly RAG and Settings;
- HO seeing bank details on step 3, the RK cost alert, design versions (approve, lock, unlock), site photos and snags (including the soft launch waiting for open snags).

## Layout

```
prisma/          schema, migrations, seed
src/app/         pages ((app)/hq, owner, stores, notifications) and API routes (api/)
src/modules/     one config file per launch step (who does it, approver, points, fields, offsets, photo minimums)
src/lib/         auth, services (business rules), queries, storage, scheduling, status
src/components/  UI (shadcn/ui)
tests/           unit tests
```
