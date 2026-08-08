---
id: payroll-and-hr-controls-testing
title: Payroll and HR Controls Testing
type: procedure
summary: >
  Tests whether new hires, terminations, and compensation changes are
  authorized before they take effect in payroll, and whether the person
  who can change an employee's pay rate is independent of the person who
  approves the payroll run that pays it.
---

# Payroll and HR Controls Testing

## Scope

Covers the controls around getting an employee correctly and timely onto
(and off of) payroll, and around changes to compensation once they're on
it. Termination-driven system-access removal is tested here for timing
against the HR record, but the access-control mechanics themselves are
covered in [IT User Access Review](it-user-access-review.md) — this
procedure focuses on the payroll and HR-data side, not system
permissions.

## New Hire and Compensation Change Authorization

Sample new hires and compensation changes (merit increases, promotions,
bonus awards) processed during the period and confirm each was approved
by the employee's manager and, where the policy requires a second level
for compensation above a threshold, by that second approver as well,
before the change was entered into the payroll system. A compensation
change entered first and approved after the fact defeats the point of the
control even if the approval eventually happens, since payroll may
already have processed a run using the unapproved rate.

## Segregation Between Rate Entry and Payroll Approval

Confirm the person with system access to enter or change an employee's
pay rate, banking details, or hours is not the same person who approves
the payroll run for disbursement, and that neither role is held by
someone who can also approve their own pay changes. Test a sample of pay
rate changes against the system's change log to confirm the entry and
approval steps were performed by different user accounts — a control that
exists on paper as two roles but is executed by one person holding both
system permissions provides no real segregation, regardless of the
written policy.

## Termination and Final Pay Testing

Compare the HR termination report for the period against the payroll
system to confirm each terminated employee's regular pay was stopped
effective the correct date and any final pay (accrued but unused
vacation, severance) was calculated and disbursed per policy, not
estimated informally. Separately confirm — cross-referencing [IT User
Access Review](it-user-access-review.md) — that system access removal for
the same population was completed within the required window; a
termination that stops pay correctly but leaves system access active is
still a finding, just a different control's finding.

## Related

- [IT User Access Review](it-user-access-review.md)
- [Segregation of Duties Review](segregation-of-duties-review.md)
