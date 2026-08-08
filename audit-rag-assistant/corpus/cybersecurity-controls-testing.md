---
id: cybersecurity-controls-testing
title: Cybersecurity Controls Testing
type: procedure
summary: >
  Tests whether known vulnerabilities are remediated within a
  risk-based SLA, whether security incidents are actually detected and
  contained on the timeline the incident-response plan states, and
  whether security-awareness training and phishing simulation results
  show real behavior change rather than just completed checkboxes.
---

# Cybersecurity Controls Testing

## Scope

Covers vulnerability management, security incident response, and
security-awareness testing at the enterprise level, distinct from the
system-specific access and change controls covered in [IT User Access
Review](it-user-access-review.md) and [IT Change Management
Testing](it-change-management-testing.md). This procedure asks whether
the organization can find its own weaknesses and respond when something
goes wrong, not whether any one system's controls are individually sound.

## Vulnerability Management Testing

Sample vulnerabilities identified through scanning or penetration testing
during the period and confirm each was remediated (patched, mitigated, or
formally risk-accepted by an authorized owner) within the SLA defined for
its severity rating — critical vulnerabilities on a materially shorter
clock than low-severity ones. A vulnerability still open past its SLA
with no documented risk-acceptance is a finding regardless of whether it
was ever exploited; the control being tested is whether the remediation
process actually closes gaps on schedule, not whether the organization
got lucky. Separately, confirm the scanning program's own scope — systems
excluded from scanning, intentionally or by oversight — is documented and
periodically reassessed, since an unscanned system can't generate
findings to remediate in the first place.

## Security Incident Response Testing

Select security incidents (or, where none occurred, a tabletop exercise)
from the period and test the response against the incident-response
plan's own stated timelines: time to detection, time to containment, and,
where required by policy or regulation, time to notification of affected
parties or regulators. Compare the plan's stated roles against who
actually performed each step — a plan that names a specific escalation
path on paper but was executed informally through ad hoc communication is
a design gap even if the incident was ultimately contained, since the
next incident may not have the same people available to respond from
memory.

## Security Awareness and Phishing Simulation Testing

Review security-awareness training completion rates and simulated
phishing campaign results for the period, and test whether repeat
clickers — employees who click simulated phishing attempts across
multiple campaigns — receive escalated follow-up (targeted retraining, a
conversation with their manager) rather than the same generic training
as everyone else. A training program with a high completion rate but no
escalation path for repeat failures is optimizing for a checkbox metric
rather than the underlying risk the training exists to reduce.

## Related

- [IT General Controls Overview](it-general-controls-overview.md)
- [Business Continuity and Disaster Recovery Testing](business-continuity-and-disaster-recovery-testing.md)
