---
id: data-privacy-compliance-testing
title: Data Privacy Compliance Testing
type: procedure
summary: >
  Tests whether the organization's inventory of personal data is
  complete, whether data subject access and deletion requests are
  honored within required timeframes, and whether third parties
  receiving personal data are bound by adequate data-protection terms.
---

# Data Privacy Compliance Testing

## Personal Data Inventory Completeness

Compare the organization's documented personal-data inventory (what
personal data is collected, where it's stored, which systems process it)
against an independent source — a data-flow walkthrough with the
systems team, or a sample of actual database schemas — to test for
undocumented collection points. A privacy program built on an incomplete
inventory can't reliably honor downstream rights-request or retention
obligations, since it may not even know a given system holds in-scope
data.

## Data Subject Request Handling

Sample data subject access, correction, and deletion requests received
during the period and confirm each was authenticated (confirming the
requester is who they claim to be, or an authorized agent), fulfilled
within the required regulatory window, and — for deletion requests —
actually propagated to backup and archival copies, not just the primary
production system. A deletion that removes a record from the live
database but leaves it recoverable in an untouched backup does not
satisfy the request.

## Retention and Deletion Schedule Adherence

Select data categories with a defined retention period and confirm
records past that period are actually purged on the schedule the policy
states, rather than retained indefinitely by default because no
automated deletion job exists. Retaining data past its stated retention
period is itself a compliance gap even absent any misuse, since it
expands the population exposed if a breach does occur.

## Third-Party Data Sharing Agreements

For vendors and partners receiving personal data (see [Third-Party
Vendor Risk Management](third-party-vendor-risk-management.md)), confirm
each has a signed data-processing agreement specifying permitted uses,
required security controls, and breach-notification obligations before
data was first shared — not executed retroactively after the sharing
relationship was already underway.

## Related

- [Third-Party Vendor Risk Management](third-party-vendor-risk-management.md)
- [IT User Access Review](it-user-access-review.md)
