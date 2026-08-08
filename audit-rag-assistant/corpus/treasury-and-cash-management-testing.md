---
id: treasury-and-cash-management-testing
title: Treasury and Cash Management Testing
type: procedure
summary: >
  Tests whether bank account changes are properly authorized, whether
  wire transfers require independent dual approval before funds move,
  and whether excess cash is invested only within board-approved
  instrument and counterparty limits.
---

# Treasury and Cash Management Testing

## Scope

Covers bank account administration, outbound wire and ACH payment
authorization, and short-term investment of excess operating cash. Does
not cover routine accounts-payable disbursements against approved
invoices — see [Procurement and Purchase Order Matching
Controls](procurement-and-purchase-order-matching-controls.md) for that —
this procedure is about treasury-specific movement of cash outside the
normal purchase-to-pay cycle.

## Bank Account Administration

Sample bank accounts opened, closed, or modified (signatory changes,
authorized-user changes) during the period and confirm each was approved
by an authorized treasury officer per the delegation-of-authority policy,
and that the bank's own signatory records were updated to remove a
departed signatory's authority, not just internally documented as
removed. A signatory who left the treasury function but remains active on
a bank's signature card is a finding regardless of whether they ever
initiated a transaction — the control being tested is whether authority
actually terminates, not whether it was misused.

## Wire Transfer and Payment Authorization

Sample outbound wire and ACH transfers during the period and confirm each
required initiation by one authorized user and independent release/
approval by a second, with no single user able to both initiate and
release a transfer above the policy's dollar threshold. For transfers
above a higher secondary threshold, confirm a callback verification was
performed to a previously-validated phone number — not a number supplied
in the same email or instruction requesting the wire — since that
callback is the specific control designed to catch business-email-
compromise fraud rather than internal error. A transfer released without
callback verification where one was required is a finding even if the
transfer turned out to be legitimate.

## Cash Forecasting and Investment Policy Compliance

For periods where excess operating cash was placed in short-term
investments, confirm each investment was made in an instrument type and
with a counterparty both on the board-approved list, and within approved
concentration limits (no single counterparty or instrument holding an
outsized share of total invested cash). An investment that technically
matches the approved instrument type but breaches a concentration limit
is still a finding — the limit exists specifically to bound loss exposure
if any single counterparty fails, independent of whether the instrument
itself was appropriate.

## Related

- [Journal Entry Testing](journal-entry-testing.md)
- [Segregation of Duties Review](segregation-of-duties-review.md)
