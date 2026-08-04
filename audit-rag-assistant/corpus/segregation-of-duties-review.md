---
id: segregation-of-duties-review
title: Segregation of Duties Review
type: procedure
summary: >
  Identifies whether any individual holds a combination of system access
  or process roles that would let them both commit and conceal an
  improper transaction without a second person's involvement.
---

# Segregation of Duties Review

## The Core Risk

Segregation of duties (SoD) exists to make sure no single person can both
carry out and cover up a transaction end-to-end — e.g. creating a vendor
and approving payments to that vendor, or initiating a journal entry and
approving their own entry. The control isn't about distrust of any one
person; it's that a single point of control removes the natural check a
second reviewer provides, regardless of intent.

## Building the SoD Conflict Matrix

Start from a defined list of incompatible role combinations for the
relevant systems (e.g. "create vendor" + "approve payment," "post journal
entry" + "approve journal entry," "modify price master" + "approve sales
order override") agreed with process owners before testing begins. The
conflict matrix should be reviewed and updated periodically as system
roles change — testing against a stale matrix will miss real conflicts
introduced by new roles or missed by old ones.

## Testing Actual System Access Against the Matrix

Pull actual role/permission assignments from each in-scope system and run
them against the conflict matrix to identify every user holding an
incompatible combination — this should be a systematic comparison against
the full user population, not a sample, since SoD conflicts are
comparatively rare and a sample could easily miss the small number of
users who actually hold conflicting access. Each conflict identified needs
either a compensating control (e.g. a monitoring report someone
independent reviews) or a remediation plan to remove the conflicting
access.

## Compensating Controls

Where a genuine SoD conflict can't be eliminated (small teams are the most
common reason), confirm a compensating control actually operates — a
periodic report of transactions performed by the conflicted user,
reviewed and evidenced by someone independent of that user, at a
frequency tight enough to catch an issue before it compounds. A
compensating control that exists on paper but was never actually performed
during the period doesn't mitigate the conflict; test evidence of
performance, not just the existence of the control description.

## Related

- [IT User Access Review](it-user-access-review.md)
- [Vendor Master Data Control Testing](vendor-master-data-control-testing.md)
