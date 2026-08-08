---
id: data-governance-testing
title: Data Governance Testing
type: procedure
summary: >
  Tests whether critical data domains have a named, accountable owner and
  classification, whether reporting-critical data reconciles to an
  independent source before it's used, and whether changes to shared
  reference/master data go through a controlled process rather than
  direct, unreviewed edits.
---

# Data Governance Testing

## Scope and Distinction From Related Procedures

This procedure tests data as an asset to be governed for quality,
ownership, and reporting integrity — distinct from [Data Privacy
Compliance Testing](data-privacy-compliance-testing.md), which tests
regulatory rights and obligations around personal data specifically, and
from [Vendor Master Data Control Testing](vendor-master-data-control-testing.md),
which tests vendor master data specifically for payment-fraud risk. A
data set can be perfectly compliant with privacy law and free of
vendor-fraud indicators while still being ungoverned in the sense this
procedure tests: no clear owner, no quality control, and no change
discipline.

## Data Classification and Ownership Testing

Sample critical data domains (customer, financial, product, employee) and
confirm each has a documented, named business owner accountable for its
quality and appropriate use, and a classification level (e.g., public,
internal, confidential, restricted) that determines its handling and
access requirements. A data domain with no named owner is a finding on
its own, independent of whether any specific quality or access problem
has yet surfaced — an unowned data domain has no one accountable to fix
it when a problem eventually does appear.

## Data Quality Control Testing

For data feeding financial or regulatory reporting, confirm a
reconciliation or tie-out control exists comparing the data used in
reporting against an independent source (a subledger, a source system, an
external confirmation) before the reporting output is finalized, and
sample instances of that reconciliation to confirm it was actually
performed and any variance investigated and resolved, not just noted and
carried forward. A reconciliation control that exists in the process
documentation but shows the same unresolved variance carried across
multiple periods is providing the appearance of a control without its
substance.

## Master Data Governance

Sample changes made during the period to shared reference or master data
— chart of accounts, cost center hierarchies, product master, customer
master (excluding vendor master, covered separately) — and confirm each
change went through the defined change-request and approval process
rather than a direct edit by someone with underlying system access. Direct
edits to shared master data are higher-risk than an equivalent change to
a single transaction, since an error or unauthorized change propagates to
every transaction and report that references the changed record
afterward, not just one.

## Related

- [Data Privacy Compliance Testing](data-privacy-compliance-testing.md)
- [Vendor Master Data Control Testing](vendor-master-data-control-testing.md)
