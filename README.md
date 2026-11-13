# Sangeetha Mobiles – Store Launch Tracker

Tracks every new store from location finalisation to launch. Store owners update modules from their phones; HQ sees status, delays and costs for every store on one dashboard.

Spec: *Store Launch Tracker: Project Spec* (11 Nov 2026). Undecided points: [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).

## Run locally

Needs Node.js 20+.

```bash
npm install            # also generates the Prisma client
cp .env.example .env   # fill in database URLs and SESSION_SECRET (32+ random chars)
npm run db:migrate     # create tables
npm run db:seed        # demo data (8 fictional stores, 6 demo users)
npm run dev            # http://localhost:3000
```

Production mode: `npm run build && npm start`. To sign in from a phone on the same Wi-Fi over plain http, set `COOKIE_SECURE=false`.

## Demo accounts (development only)

Password for all: **`Demo@2026`** (`SEED_PASSWORD` in `.env`). All data is fictional and labelled "Demo".

| Role | E-mail | Sees |
|---|---|---|
| SuperAdmin (HQ) | hq.admin@sangeetha.test | All stores |
| Regional Manager | rm.south@sangeetha.test | KA, KL, TN, TG |
| Store owner | owner.arjun@sangeetha.test | Jayanagar (fit-out: rejected, blocked, overdue), Edappally, Gomti Nagar |
| Store owner | owner.meera@sangeetha.test | T. Nagar (Token Paid), Kukatpally (Ready for Launch) |
| Store owner | owner.rahul@sangeetha.test | Kothrud (Launched), Vastrapur (fit-out, pending approval) |
| Store owner | owner.fatima@sangeetha.test | Salt Lake (Keys Received) |

Re-running `npm run db:seed` resets the demo data.

## Features

**Built and tested**
- Login (e-mail + password, bcrypt, 8-hour JWT cookie), 3 roles, access checked on every API call and page
- Store owner (mobile-first): My stores, Add store with map pin picker, store detail, module forms (config-driven fields), camera/photo/PDF upload, save draft / mark Completed, Key Handover with auto-scheduling, comments, HQ feedback
- HQ (desktop-first): dashboard cards, store × module grid (colours + overdue outline), filters (state, city, status, owner, launch month, search, sort), approvals queue, approve / reject with comment, status override (On Hold / Dropped), delays report, cost report with chart, map view (Leaflet + OpenStreetMap), settings (users, store assignment, scheduling defaults, branding checklist)
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
npm test          # 37 unit tests (status rules, validation, scheduling, access, store codes)
npm run typecheck
npm run lint
```

End-to-end, 79 checks over the real API and database all passed. They cover pages for every role, permissions, store creation, every validation rule, approve/reject, key handover scheduling, notifications, comments, exports and settings.

## Layout

```
prisma/          schema, migrations, seed
src/app/         pages ((app)/hq, owner, stores, notifications) and API routes (api/)
src/modules/     one config file per module (fields, offsets, photo minimums)
src/lib/         auth, services (business rules), queries, storage, scheduling, status
src/components/  UI (shadcn/ui)
tests/           unit tests
```
