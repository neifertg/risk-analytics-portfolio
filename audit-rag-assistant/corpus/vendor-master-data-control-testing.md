---
id: vendor-master-data-control-testing
title: Vendor Master Data Control Testing
type: procedure
summary: >
  Tests whether new-vendor and vendor-change requests in the ERP vendor
  master file go through required approval and duplicate-detection
  controls, since a weak vendor master file is a common enabler of
  fraudulent or duplicate payments.
---

# Vendor Master Data Control Testing

## Why the Vendor Master File Matters

Every payment traces back to a vendor master record — bank account,
payment terms, tax ID. A vendor record created or changed without proper
review is one of the most common ways fictitious-vendor fraud and
duplicate payments get into the system, because once the master record
exists, downstream payments can look completely routine.

## New Vendor Setup Testing

Sample new vendor records created during the period and confirm each has:
a completed vendor onboarding form with a business justification, evidence
of a segregation-of-duties check (the requester cannot also be the
approver), and — for vendors above a dollar threshold — a W-9 or
equivalent tax form on file before the first payment. Flag any vendor
record where the bank account or address matches an existing employee
record; this is a specific, high-value fraud indicator, not just a
process gap.

## Vendor Change Testing

Changes to bank account or payment address on existing vendor records
carry similar risk to new-vendor setup, sometimes more — a change to a
long-standing, trusted vendor's bank details is a classic business email
compromise pattern. Sample vendor master change records and confirm each
bank-detail change has independent verification (e.g. a callback to a
phone number on file, not one provided in the change request itself)
before it took effect.

## Duplicate Vendor Detection

Run the vendor master file through a fuzzy-matching check on name, tax
ID, address, and bank account to identify potential duplicate vendor
records — the same real-world vendor registered twice, deliberately or by
accident, which can enable duplicate payment or make spend harder to
analyze. Any match above the matching threshold should be investigated
and, where confirmed duplicate, merged or deactivated per the vendor
master governance procedure.

## Related

- [Expense Reimbursement Testing](expense-reimbursement-testing.md)
- [Segregation of Duties Review](segregation-of-duties-review.md)
