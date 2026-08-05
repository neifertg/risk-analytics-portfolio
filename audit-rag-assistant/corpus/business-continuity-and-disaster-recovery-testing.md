---
id: business-continuity-and-disaster-recovery-testing
title: Business Continuity and Disaster Recovery Testing
type: procedure
summary: >
  Tests whether business continuity and disaster recovery plans are kept
  current and whether recovery time/point objectives are validated
  through actual failover or tabletop exercises rather than assumed from
  the plan document alone.
---

# Business Continuity and Disaster Recovery Testing

## Plan Currency

Confirm the business continuity plan (BCP) and disaster recovery (DR)
plan have been reviewed and updated within the required cycle (commonly
annually) and reflect the organization's actual current systems, key
personnel, and dependencies — not a prior year's org chart or a system
that's since been decommissioned or replaced. A plan that still names a
departed employee as the primary incident commander is a strong signal
the review step is a formality rather than a real update.

## Recovery Time and Recovery Point Objective Validation

For each in-scope critical system, confirm the plan states a recovery
time objective (RTO — how long recovery may take) and recovery point
objective (RPO — how much data loss is tolerable), and obtain evidence
from the most recent test that actual recovery performance met those
targets. A documented RTO/RPO with no corresponding test evidence is an
untested assumption, not a control — the objective only has value once
it's been demonstrated achievable under realistic conditions.

## Tabletop and Failover Exercise Evidence

Sample the most recent tabletop exercise or live failover test and
confirm it exercised a realistic scenario (not a scenario chosen because
it was easy to pass), included the actual personnel who'd be responsible
during a real event, and produced a documented list of gaps with owners
and target remediation dates. Test whether gaps identified in the prior
exercise were actually closed before the next one — a recurring gap
across multiple exercise cycles indicates the exercise process isn't
driving real improvement.

## Related

- [IT Change Management Testing](it-change-management-testing.md)
- [IT User Access Review](it-user-access-review.md)
