---
id: procurement-and-purchase-order-matching-controls
title: Procurement and Purchase Order Matching Controls
type: procedure
summary: >
  Tests whether purchases are authorized before commitment, whether the
  three-way match between purchase order, receipt, and invoice is
  actually enforced before payment, and whether variances and manual
  overrides are reviewed rather than routinely approved.
---

# Procurement and Purchase Order Matching Controls

## Pre-Commitment Authorization

Sample purchase orders issued during the period and confirm each was
approved by someone with authority at or above the PO's dollar amount
per the delegation-of-authority matrix, and that the approval was
recorded before the order was placed with the vendor — not obtained
afterward to paper over a purchase that already happened. A PO approved
after the corresponding invoice date is a strong indicator the
authorization step is being treated as a formality.

## Three-Way Match Enforcement

Select a sample of paid invoices and confirm the system actually
enforced a three-way match — purchase order, goods receipt or service
confirmation, and invoice — before releasing payment, with quantities
and pricing agreeing across all three documents within policy tolerance.
Where the system allows payment on a two-way match (PO and invoice only,
no receipt confirmation) for any transaction category, confirm that
exception is a deliberate, documented policy choice and not a control
gap nobody decided on purpose.

## Variance and Override Review

Sample transactions where the three-way match failed and was manually
overridden to allow payment, and confirm each override has a documented
business reason and approval from someone independent of the person
requesting the override. A high volume of overrides concentrated on one
approver or one vendor is worth flagging on its own, independent of
whether any individual override was properly justified — it suggests the
matching tolerance or process itself may be poorly calibrated.

## Related

- [Vendor Master Data Control Testing](vendor-master-data-control-testing.md)
- [Contract Compliance Testing](contract-compliance-testing.md)
