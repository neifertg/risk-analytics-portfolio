---
id: it-risk-assessment-and-audit-universe
title: IT Risk Assessment and Audit Universe
type: procedure
summary: >
  Tests whether the IT system inventory feeding the risk assessment is
  actually complete, whether risk-scoring criteria are applied
  consistently across systems rather than informally, and whether
  high-risk systems are actually being audited within the coverage
  cycle the plan claims rather than repeatedly deferred.
---

# IT Risk Assessment and Audit Universe

## Scope and Relationship to the Enterprise Risk Assessment

This procedure tests the IT-specific slice of the broader audit-planning
process described in [Audit Risk Assessment
Methodology](risk-assessment-methodology.md) — the same inherent-risk /
control-risk logic applies, scoped to IT systems and infrastructure
specifically. It asks a narrower question than any single IT audit does:
not "is this one system well-controlled," but "does the population of
systems getting IT-audit attention actually reflect where the real IT
risk sits."

## IT Asset and System Inventory Completeness

Compare the system inventory used to build the IT audit universe against
an independent source — a network/asset discovery scan, a cloud-account
inventory, or a sample of business-unit-reported systems not on the
central list — and test for systems present in reality but missing from
the inventory the risk assessment was scored against. An IT risk
assessment can only rank what it knows exists; a system missing from the
inventory doesn't get a low risk score, it gets no score at all and no
chance of ever being planned for audit, regardless of how much risk it
actually carries.

## Risk Scoring Consistency Testing

Sample systems from the IT audit universe and confirm each was scored
against the same documented criteria — data sensitivity, financial-
reporting relevance, external connectivity, change frequency, prior
audit history — rather than a score that appears to reflect an
individual reviewer's informal judgment inconsistent with how comparable
systems were scored. Two systems with materially similar risk
characteristics receiving materially different scores, with no
documented reason for the difference, is a finding about the scoring
process itself, independent of whether either individual score turns out
to be defensible on its own.

## Audit Coverage Adequacy

Compare the IT audit universe's risk ranking against the actual audit
plan and audit history over the past several cycles, and test whether
systems ranked highest-risk have actually received audit coverage within
the interval the methodology commits to (e.g., annually for the
highest tier), rather than being repeatedly rolled forward in favor of
lower-risk, easier-to-schedule engagements. A high-risk system that has
gone several cycles without audit coverage despite consistently ranking
at the top of the universe indicates the risk ranking isn't actually
driving the plan — which defeats the purpose of doing a risk-based
ranking in the first place.

## Related

- [Audit Risk Assessment Methodology](risk-assessment-methodology.md)
- [IT General Controls Overview](it-general-controls-overview.md)
