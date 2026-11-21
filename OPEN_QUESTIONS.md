# Open questions

Source of truth: **`Sangeetha_New_Outlet_Launch_SOP_v2.pptx`** (11 slides), built "tooth and nail" from 18 Nov 2026.

**Answered 21 Nov 2026** (Sangeetha, Google Sheet): items 1, 2, 6, 8, 10, 16 and 20 plus notifications — see "Decisions" below.

The app follows every rule the slides state. The items below are **not** stated in the slides. For each one the app uses the interim choice shown. Please confirm or correct them; most can be changed in **Settings** without code.

## Decisions (21 Nov 2026)
| Question | Answer | In the app |
|---|---|---|
| When is the token advance "paid"? | When HO records it | Done (unchanged). |
| Boss + CEO: both, or one? | Any one | Done (unchanged). |
| Who may see landlord KYC (PAN, Aadhaar, bank)? | Accounts | Done: Accounts only. Whoever fills in step 1 can type or replace the values but sees "hidden" after saving. |
| Who creates a new store? | Manju or RK | Done: Settings → Users → "Can create new stores" (given to RK; add Manju). HQ admin can also create. Store owners no longer can. |
| Which MOU points are mandatory? | All except MOU copy and GST no. | Done (unchanged). |
| Login | E-mail OTP | To build: needs an e-mail sending service (Resend via Vercel) and a sender domain. |
| Day 1 of the schedule | Once the keys are received | Open: the setup clock already starts at the keys; see the follow-up questions. |
| Notifications | E-mail | To build with the same e-mail service. |

## Who does what
| # | Question (slide) | What the app does now |
|---|---|---|
| 1 | Who creates a new store in the app? (slide 2: location identification by ASM / SH) | The store owner or HQ creates the store record; ASM, SH, BH and State Admin can then fill in the 41-point sheet. |
| 2 | "Boss + CEO": do **both** have to approve, or is one approval enough? (slides 2, 3) | One approval from the Leadership team. |
| 3 | Is **RK** one person or a team? Who stands in when RK is away? | A team called "RK". HQ can approve any step as a fallback. |
| 4 | Who approves the **interior vendor quotation** (slide 10, weeks 1–2)? | Boss + CEO. It can start from week 1, before the location is approved. |
| 5 | Slide 5 step 5 says the APX PO is "raised automatically". There is no APX connection. | Accounts or Purchase types the APX PO number after Accounts approves. It does not hold up "Token paid". |
| 6 | Is the token advance "paid" when Accounts approves, or when HO releases the money? (slide 5 steps 3–4) | When HO records the payment (amount, date, mode, UTR). Until then the step is not green and the next steps stay locked. |
| 7 | Soft launch (stage 7): who runs the audit and marks it done? | State Admin or ASM. Marking it done records the soft launch date. |

## Rules and data
| # | Question (slide) | What the app does now |
|---|---|---|
| 8 | 41-point MOU sheet (slide 3): which points are mandatory? | All of them, except 36 (MOU copy) and 37 (GST no.), which say "if applicable". |
| 9 | Branch code (point 2). | The store code the app gives (e.g. SGM-KA-BLR-0001). Points 1, 2, 4, 5 and 6 come from the store record. |
| 10 | Who may see the landlord's PAN, Aadhaar and bank details (points 31–35)? | Accounts, HO, Legal, Boss + CEO, HQ and whoever fills in step 1. Everyone else sees "Hidden (KYC)". Only the last 4 Aadhaar digits are ever stored. |
| 11 | Power load (slide 4): what about stores above 3,000 sq ft? | The table ends at 3,000 sq ft (30 kW); bigger stores need at least 30 kW and are flagged. Single-phase or too little load blocks completion and approval of steps 1 and 2. |
| 12 | AC sizing (slide 8): "1 ton per 150 sq ft" — rounded up? | Rounded up (1,200 sq ft → 8 ton). Split AC below 1,000 sq ft, cassette from 1,000 sq ft. |
| 13 | T-7 rule (slide 6): how is "one week before" checked? | The sign board and material ordering must both be done, with a finish date at least 7 days before the handover date. Otherwise RK cannot accept the handover. |
| 14 | Legal & statutory (stage 4) includes the balance deposit "upon handover". | Legal can work on it from step 2, but can only mark it done after the keys. |
| 15 | Photo minimums. | None (the slides ask for none). Each step has an optional photo upload; required documents (property tax, building plan, landlord confirmation, signed MOU, agreement, licences, GST certificate, quotation) must be uploaded. |

## Schedule
| # | Question (slide) | What the app does now |
|---|---|---|
| 16 | 13-week chart (slide 10): when does week 1 start? | The day the store is created. Keys are planned for week 8 until point 11 (expected key date) is filled in; the soft launch target is week 13, then keys + 5 weeks once the keys are in. |
| 17 | Stage 6 department tracks: start days and durations after the keys. | From the chart: Marketing 0+35, Interiors 0+28, Brand promoters 0+35, HR 0+21, Stocks 7+28, Finance & IT 0+28, Trade licence 0+28, Launch planning 7+28 days. On-site work one week each: furniture, electrical, AC, branding. Editable in Settings → Scheduling. |
| 18 | Weekly RAG (slide 11): what makes a step Amber? | Due within 3 days, late to start, or waiting for an approval / HO's payment. Red = overdue or blocked. Sent every Monday to HQ, State Admin, ASM, SH, BH, Legal, Marketing and HO. |
| 19 | One week before the expected keys (slide 6), who is told? | Every Stage 6 team and RK. If the sign board or materials are not done, State Admin, ASM, Marketing, Interiors and IT/Admin get a T-7 warning. |

## From the earlier spec (still apply)
| # | Question | What the app does now |
|---|---|---|
| 20 | Login: phone OTP, e-mail + password, or both? | E-mail + password. OTP later (needs a paid SMS provider). |
| 21 | Store code: city codes and numbering. | Known city list (BLR, CHE, …), else the first 3 letters; one running number overall. |
| 22 | Can HQ reopen an approved step? | No. Approved steps are locked. |
| 23 | Daily checks (delays, T-7 alerts, weekly RAG). | Run on the first page load of each day (India time). |
| 24 | Data residency: the Supabase project is in Seoul. | Move to a Mumbai project before real data. |
