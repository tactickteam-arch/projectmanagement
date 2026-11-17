# Open questions

Sources of truth:
- *Sangeetha Mobiles – Store Launch Tracker: Project Spec* (11 Nov 2026).
- *New outlet launch: user flow* diagram (17 Nov 2026). It replaces the spec's module list.

None of the items below is decided by these sources. The demo uses the interim choice shown for each. These are demo assumptions, not confirmed business rules. Most of them can be changed in **Settings** without code.

## From the launch-flow diagram (17 Nov)
| # | Question | Demo assumption |
|---|---|---|
| 1 | What are the real **8 points of the landlord check**? The diagram names only two: commercial terms and civil work by landlord. | Placeholders: commercial terms; civil work done; title documents; electrical load; water and washroom; shutter and frontage; signage permission; building NOC. All 8 must be marked "Cleared" before RK can approve. Editable in Settings → Checklists. |
| 2 | What are the real **8 points of the key handover check**? | Placeholders: all keys; civil work complete; flooring, walls and ceiling; power and meter; water and washroom; shutter and locks; no leakage; meter readings. All must be "OK". Editable in Settings → Checklists. |
| 3 | **Who is RK?** One person or a team? Should someone stand in when RK is away? | A team called "RK", with one demo user. HQ (SuperAdmin) can approve any step as a fallback. |
| 4 | "Boss + CEO": do **both** have to approve, or is one approval enough? | One approval from the Leadership team is enough. |
| 5 | Step 2 is "managed by Accounts", but its points belong to State admin and ASM. Who fills in the step in the app? | Accounts and State admin. ASM has no login (no role for ASM yet). |
| 6 | Step 1 owners: ASM, SH, BH and State admin are Sangeetha people, but the step is "done by store owner". Who fills it in? | The store owner fills it in. Each point shows its owner (ASM · SH, SH/BH, State admin) as a label. |
| 7 | Token advance is approved by Accounts, and Accounts also fills it in. Is self-approval OK, or should a second person in Accounts approve? | The same team may fill in and approve. |
| 8 | Who raises the **PO in APX**: Accounts or Purchase? Should the app check the PO number against APX? | Either team can record the APX PO number after approval. There is no APX integration; the number is typed in. |
| 9 | Step 4 "runs alongside steps 3–5". Does it block anything, such as the key handover or the soft launch? | It starts after the landlord check, has no approver and blocks nothing. It is still needed for "all steps done" before the soft launch. |
| 10 | Does step 4 need an approver (e.g. Legal head)? | No approver: Legal marks it green. |
| 11 | **Trade licence** (step 6 track) vs **S&E / BBMP / Labour licences** (step 4): are they different licences? | They are kept separate. Step 4 is owned by Legal; the Trade licence track is also owned by Legal. |
| 12 | What are the start days and durations of the **8 setup tracks** after Day 0? | Placeholders: Marketing 0+25, Interiors 0+21, Brand promoters 14+14, HR 0+21, Stocks 21+7, Finance & IT 0+21, Trade licence 0+21, Launch planning 14+14. Editable in Settings → Scheduling. |
| 13 | Do any setup tracks need approval (e.g. Interiors by HQ, Marketing branding by Marketing head)? | None: each department marks its own track green. Settings → Steps & approvals can add an approver to any step. |
| 14 | Can some setup tracks start before the keys (e.g. HR hiring, stock ordering)? | All tracks start after RK accepts the handover, as in the diagram. |
| 15 | Which teams are **state-wise**? Should a Bengaluru State admin see only Karnataka stores? | Each team member can be limited to states in Settings; the demo team members see all states. |
| 16 | Soft launch: who confirms it, and is there a "grand launch" later? | The store owner or HQ enters the soft launch date once all departments are green. No grand-launch step. |
| 17 | Photo minimums per step (not in the diagram). | Location filing 1; landlord check 1; key handover 2; Marketing 2; Interiors 2; Brand promoters 1; Finance & IT 1; the others 0. |

## From the spec's own list
| # | Question | Demo assumption |
|---|---|---|
| 18 | Login: phone OTP, e-mail + password, or both? | E-mail + password (decided 11 Nov). OTP deferred (needs a paid SMS provider). |
| 19 | Hosting: Sangeetha servers or cloud? | Supabase PostgreSQL (Seoul region) and Vercel. |

## Found while building
| # | Question | Demo assumption |
|---|---|---|
| 20 | Store code: city codes list, and is NNNN global / per state / per city? | Known city list (BLR, CHE, …) else first 3 letters; one running number overall. |
| 21 | Which fields are mandatory before "Completed"? | Every point of the step; handover date and "received by" on the key handover; the checklist rules above; photo minimums; a blocker reason when Blocked. |
| 22 | Planned end = start + duration? | Yes. |
| 23 | Can HQ reopen an approved step? | No. Approved steps are locked. |
| 24 | Target launch on handover: overwrite or keep an earlier date? | Filled only if empty (Day 0 + 30, editable in Settings). |
| 25 | Re-entering the handover date: which tracks are rescheduled? | Only tracks still Not Started. |
| 26 | Can state/city change after creation (store code depends on them)? | No. |
| 27 | Overdue check schedule (spec: daily). | Runs on the first page load of each IST day; overdue tracks notify their own departments. |
| 28 | Session length. | 8 hours. |
| 29 | How users get their first password / reset. | SuperAdmin sets and resets it in Settings. |
| 30 | Competitor list for "nearby competitors". | Free text. |
| 31 | Data residency: Supabase project is in Seoul. | Move to a Mumbai project before real data. |
