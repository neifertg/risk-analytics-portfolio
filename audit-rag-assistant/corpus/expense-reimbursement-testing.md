---
id: expense-reimbursement-testing
title: Expense Reimbursement Testing
type: procedure
summary: >
  Tests employee expense reports for policy compliance, proper approval,
  and receipt support, with particular attention to split transactions
  used to stay under approval or receipt thresholds.
---

# Expense Reimbursement Testing

## Objective

Confirm employee expense reimbursements comply with the travel and
expense (T&E) policy, are supported by adequate documentation, and were
approved by someone with actual authority over the employee's spending —
not just routed through an approval workflow that rubber-stamps whatever
is submitted.

## Documentation and Policy Compliance

For each sampled expense report, confirm an itemized receipt exists for
every line item above the policy's no-receipt threshold, the expense
category matches the policy's allowable list, and any exception to policy
(e.g. a meal over the per-person limit) has an explicit business
justification attached, not just the manager's approval alone. A manager
approval without a justification note for an over-policy item should be
treated as a documentation exception even if the approval itself is
genuine.

## Approval Authority Testing

Confirm the approver on each sampled report is actually the employee's
manager or someone with delegated approval authority for that employee —
self-approval, or approval by a peer rather than a manager, is a
segregation-of-duties failure regardless of whether the expense itself
was legitimate. Cross-reference the approver against the HR org chart
current as of the expense date, not the current org chart, since
reporting lines change.

## Split-Transaction Detection

Run expense data analytics to flag employees with multiple same-day,
same-vendor transactions that individually fall under a receipt or
approval threshold but sum above it — a common pattern for deliberately
avoiding scrutiny. A single instance may be coincidental (two separate
business meals); a pattern across multiple months for the same employee
warrants follow-up regardless of whether any individual transaction looks
suspicious on its own.

## Related

- [Vendor Master Data Control Testing](vendor-master-data-control-testing.md)
- [Data Analytics in Internal Audit](data-analytics-in-internal-audit.md)
