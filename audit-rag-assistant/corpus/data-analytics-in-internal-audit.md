---
id: data-analytics-in-internal-audit
title: Data Analytics in Internal Audit
type: overview
summary: >
  Overview of how data analytics is used across internal audit
  procedures — full-population testing instead of small samples,
  targeted exception flagging, and continuous monitoring between audits —
  and where each technique shows up elsewhere in this corpus.
---

# Data Analytics in Internal Audit

## Full-Population Testing

Where transaction data is available electronically, analytics lets an
audit test 100% of a population instead of a small sample — every journal
entry, every vendor payment, every access grant — which catches issues a
sample could statistically miss entirely. [Journal Entry
Testing](journal-entry-testing.md) and [Segregation of Duties
Review](segregation-of-duties-review.md) both rely on full-population
analytics rather than sampling for exactly this reason: the population of
interest (entries matching risk criteria, users holding conflicting
access) is small relative to the whole population, and a sample could
easily land zero hits even when real issues exist.

## Exception Flagging and Pattern Detection

Analytics is also used to flag specific patterns worth a closer look
rather than test everything equally — duplicate vendor detection in
[Vendor Master Data Control Testing](vendor-master-data-control-testing.md),
split-transaction detection in [Expense Reimbursement
Testing](expense-reimbursement-testing.md), and fuzzy matching against
employee records for fraud indicators. The common thread is defining a
specific, testable pattern in advance rather than browsing data hoping
something looks wrong.

## Continuous Monitoring Between Audits

Beyond a single audit engagement, analytics can run on a recurring
schedule to flag risk indicators between formal audits — a dashboard
re-running the SoD conflict matrix monthly, or a report re-scoring journal
entries against risk criteria every close cycle — so issues surface closer
to when they occur rather than waiting for the next scheduled audit to
catch them.

## Related

- [Journal Entry Testing](journal-entry-testing.md)
- [Segregation of Duties Review](segregation-of-duties-review.md)
- [Vendor Master Data Control Testing](vendor-master-data-control-testing.md)
- [Expense Reimbursement Testing](expense-reimbursement-testing.md)
