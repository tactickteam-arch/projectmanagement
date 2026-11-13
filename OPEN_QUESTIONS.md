# Open questions

Source of truth: *Sangeetha Mobiles – Store Launch Tracker: Project Spec* (11 Nov 2026).
Each item below is **not decided by the spec**. The demo uses the interim choice shown. These are demo assumptions, not confirmed business rules.

## From the spec's own list
| # | Question | Demo assumption |
|---|---|---|
| 1 | Spec says "8 modules" but names 7 + Key Handover ("milestone, not a full module"). "Token Advance appears twice" in the original list — is something missing (e.g. Rent Agreement)? | 7 setup modules + Key Handover milestone. Progress = approved ÷ 7. No module invented. |
| 2 | Is External Signage confirmed? | Included (it is in the spec's module list). |
| 3 | Who approves: HQ only, or Regional Managers too? | SuperAdmin only. Regional Managers view and comment. |
| 4 | Default days after key handover (placeholders). | Spec placeholders; editable in Settings → Scheduling. |
| 5 | Login: phone OTP, e-mail + password, or both? | E-mail + password (decided 11 Nov). OTP deferred (needs a paid SMS provider). |
| 6 | Hosting: Sangeetha servers or cloud? | Free Supabase PostgreSQL (Seoul region) for the demo; app runs locally. |

## Found while building
| # | Question | Demo assumption |
|---|---|---|
| 7 | Store status before Store Location is approved? | Shown as "Not yet finalised". |
| 8 | Store code: city codes list, and is NNNN global / per state / per city? | Known city list (BLR, CHE, …) else first 3 letters; one running number overall. |
| 9 | Which module-specific fields are mandatory? | None, apart from the spec rules (photos, blocker reason). |
| 10 | "Fit-out in progress: any fit-out module started" — does Blocked count? | Any status other than Not Started. |
| 11 | Planned end = start + duration? | Yes. |
| 12 | Can HQ reopen an approved module? | No. Approved modules are locked (not in spec). |
| 13 | "Location approved by HQ" / "Design approved by HQ" fields sit in the owner's form. | Owner records them; HQ approval of the module is separate. |
| 14 | Who may enter the actual launch date, and when? | Store owner or SuperAdmin, only once Ready for Launch. |
| 15 | Target launch on handover: overwrite or keep an earlier date? | Filled only if empty. |
| 16 | Re-entering the handover date: reschedule which modules? | Only fit-out modules still Not Started. |
| 17 | Can state/city change after creation (store code depends on them)? | No. |
| 18 | Overdue check schedule (spec: daily). | Runs on the first page load of each IST day. A real scheduler comes with hosting. |
| 19 | Session length. | 8 hours. |
| 20 | How users get their first password / reset. | SuperAdmin sets and resets it in Settings. |
| 21 | Competitor list for "nearby competitors". | Free text. |
| 22 | Data residency: Supabase project is in Seoul. | Move to a Mumbai project before real data. |
