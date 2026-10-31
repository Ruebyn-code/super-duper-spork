# Automatic annual leave and super estimates

The native Fast Food Award calculation now supplies separately labelled super,
annual-leave provision and employer estimates. Ordinary gross wages continue to
supply existing budgets and financial wage totals. Shift Costs and the weekly
cost dollar action show the extra estimates; no payment, pay run, fund transfer,
leave pay, expense report entry or clock event is created.

## Sources and boundaries

The retained July 2026 MA000003 edition, clauses 19 and 22, incorporates statutory
super and NES annual leave. Standard permanent employees accrue four weeks over
52 weeks: one hour per thirteen ordinary hours. Casual work does not accrue paid
annual leave. The versioned `employee-benefits.js` policy uses the standard 12%
SG rate from 1 July 2025 and requires review before 1 July 2027, alongside the
native award edition guards. Official references:

- https://www.fairwork.gov.au/leave/annual-leave
- https://www.ato.gov.au/businesses-and-organisations/super-for-employers

Automatic standard employee eligibility uses the saved date of birth: adults
qualify without a monthly earnings threshold; under-18 work must exceed thirty
recorded paid working hours in the employer's Monday–Sunday week. Overtime counts
for that hours threshold but not ordinary-time earnings. Different configured
location employers remain separate. Existing explicit eligibility and percentage
overrides survive, including omitted fields in older writers. Blank percentages
and unspecified eligibility select the automatic standard estimate.

Super uses rounded ordinary wage lines, including applicable ordinary penalties
and ordinary minimum payments. Ordinary cold and regional allowances are included
where their eligibility/ordinary allocation is known. Expense allowances and
reimbursements are excluded. Mixed overtime cold work, extra travel and ambiguous
allowance eligibility produce an unavailable super estimate rather than a guessed
complete total. These are uncapped estimates, not fund/payment, contribution-cap,
salary-sacrifice or non-standard eligibility calculations.

Annual-leave provision uses ordinary eligible hours, the employee's applied base
and the greater of 17.5% of the award minimum base or the relevant expected weekend
penalty increment for that employee/week (clause 22.2). It is a reserve estimate,
not the calculation of a later period of leave pay. Minimum-payment top-ups need
ordinary-hours evidence for leave accrual; they never invent hours worked.

## Tracked balances

Rostering → Leave shows personal balances. Authorised reviewers can view a staff
member within their employer scope. Award/employment managers explicitly set a
known starting balance and start-of-day date. Unknown historical data is never a
zero opening balance. A future confirmed starting point remains inactive until
its date arrives, which also supports new starters. Optional normal paid hours help prefill future all-day paid
absences and do not change employment agreements, rosters or availability.

Accrual uses frozen, approved native ordinary-hour slices and confirmed paid
absence hours after the starting date. Pending, rejected, open, future and other
employer/company work do not accrue. Earned hours retain an integer millisecond
numerator with denominator thirteen; reads do not round every event or write a
ledger. Missing legacy evidence or unconfirmed paid absences makes the available
balance unavailable, with a reason. Update the known starting balance or review
actual timesheets; never fabricate clock events to fill history.

Approved annual leave reserves future confirmed hours. Completed confirmed days
are taken leave and also accrue leave when eligible; cancellation-requested leave
continues to reserve until cancellation is approved. Paid absence hours can be
confirmed in the native approval popup or Paid leave hours action. Saved normal
hours, suitable written patterns and published ordinary-hour snapshots prefill
supported dates; reviewed full public holidays are zero annual-leave hours.
Legacy shared employers across locations need employer-wide review of paid hours
and public holidays rather than an assumed single working jurisdiction. Unknown
patterns, partial holidays and missing reviewed calendars need explicit
paid-hour confirmation. An absence may still be approved with hours pending.
Confirmed hours are frozen with their eligible employment type and revision audit.
Other supported paid absence types can accrue ordinary leave without deducting
annual leave. This does not grant eligibility or issue their pay.

Balances cover recorded approved hours, not an inferred complete payroll history.
Cash-outs, termination payouts, unrecorded paid work/absence and exceptional
arrangements need a confirmed starting-balance adjustment or their payroll records.

## Access and integrity

All account/leave writes use native CSRF, company/location, employer-scope and
revision checks inside the roster queue. Staff can read only their own balance;
reviewers need employer location access and managers need employment authority to
set starting balances. Kiosks do not gain balance editing or employee wage data.
Confidential absence notes/types/identifiers remain hidden; balance errors use
aggregate messages. Opening changes retain before/after audit records. Approved
pay snapshots and past review records remain frozen. Reads/previews never save,
approve leave, configure employment or call providers. Roster building remains
free of award review/note requirements; actual Timesheet approval guards remain.
