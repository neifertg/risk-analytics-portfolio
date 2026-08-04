---
id: contract-compliance-testing
title: Contract Compliance Testing
type: procedure
summary: >
  Tests whether billed amounts, rebates, and service levels under a
  significant vendor or customer contract actually match the negotiated
  contract terms, since contract terms are frequently administered
  manually outside the system that generates the invoice.
---

# Contract Compliance Testing

## Why Contract Terms Drift From Practice

Negotiated contract terms — volume discounts, rebate thresholds, service-
level commitments, most-favored-customer clauses — are often tracked in
the contract document itself rather than configured into the billing or
procurement system, which creates a real risk that invoicing and payment
simply follow whatever the system defaults to rather than what was
actually negotiated. Testing exists specifically to catch that drift.

## Pricing and Rebate Verification

Select a sample of invoices or payments under the in-scope contract and
independently recalculate the amount that should have been billed or paid
per the contract's actual pricing schedule, rebate tiers, and any
volume-based thresholds — comparing against the negotiated document, not
against a system-generated price list that may not reflect the real
agreement. Where a rebate is owed based on cumulative volume, confirm the
volume calculation used the correct measurement period and that the
rebate was actually paid or credited, not just calculated and left
outstanding.

## Service Level Compliance

For contracts with defined service-level commitments (response time,
uptime, delivery windows), obtain the vendor's or the internal team's
performance data for the period and independently verify whether
commitments were actually met, and — where they weren't — whether the
contractually specified penalty or credit was actually applied. A
service-level breach that goes unenforced represents value the
organization is entitled to but isn't collecting.

## Contract Renewal and Auto-Renewal Risk

Review contracts approaching their renewal or auto-renewal date and
confirm the business has actually re-evaluated pricing and terms rather
than letting the contract auto-renew on stale terms — a contract that
auto-renewed multiple times without renegotiation is a common way an
organization ends up paying above-market rates without anyone
specifically deciding that outcome.

## Related

- [Vendor Master Data Control Testing](vendor-master-data-control-testing.md)
