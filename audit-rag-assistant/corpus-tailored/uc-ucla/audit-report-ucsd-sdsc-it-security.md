---
id: uc-audit-report-ucsd-sdsc-it-security
title: "UC San Diego Supercomputer Center IT Security Audit (2013)"
type: audit-report
source: "UC San Diego Audit & Management Advisory Services"
summary: >
  A real UC San Diego audit (Project 2013-03, June 2013) of the San Diego
  Supercomputer Center's data-center access controls — real findings on
  credential-termination gaps, piggybacking risk, and unlocked equipment
  racks, each with a documented management corrective action.
sourceUrl: "https://auditreports.ucop.edu/?action=public_ar_display&id=5e40c17ae3abcb57"
---

# UC San Diego Supercomputer Center IT Security Audit (2013)

## What This Document Is

A real, published UC San Diego Audit & Management Advisory Services
report (Project 2013-03, June 2013), available at
[auditreports.ucop.edu](https://auditreports.ucop.edu/?action=public_ar_display&id=5e40c17ae3abcb57).
The San Diego Supercomputer Center (SDSC) is a real UC San Diego research
unit running high-performance computing and data-center colocation
services for researchers across multiple UC campuses — a specific,
real-world facility with real physical infrastructure, not a generic
"data center" example.

## Scope

The audit tested whether SDSC's IT security practices adequately
protected the confidentiality, integrity, and availability of data and
systems in its data center, including highly sensitive systems (the
report specifically notes a subcontracted federal Medicare data
processing system classified under FISMA as a moderate-risk system).

## Findings

The audit found SDSC's overall data-center security generally adequate,
but identified specific, real physical and logical access-control gaps:

- **Credential termination gap.** The Data Center had no process to
  ensure access credentials for *non-SDSC* personnel (colocation
  customers' own staff) were terminated when those individuals were
  transferred or separated — credentials were configured to never expire,
  and were only revoked when SDSC happened to learn informally that
  someone had left. This is a real, concrete instance of exactly the risk
  this corpus's synthetic
  [IT User Access Review](../../corpus/it-user-access-review.md) procedure
  tests for abstractly.
- **Piggybacking risk.** Data center entry relied on a single door with
  an access code and biometric scan — sufficient to verify the first
  person through, but not sufficient to stop a second person following
  them in unchallenged. Data Center personnel confirmed this had actually
  happened multiple times. The recommended fix (a mantrap or revolving
  security door) had been priced but not yet approved for installation at
  the time of the audit.
- **Unlocked equipment racks.** Personnel doing routine walkthroughs
  regularly found colocation racks left unlocked and unattended, because
  responsibility for locking a customer's own rack during a lapse hadn't
  been clearly assigned to Data Center staff.

Each finding carries a specific, real management corrective action (e.g.,
working with HR to regularly obtain personnel-action listings to drive
credential termination) rather than a generic "will improve" response.

## Related

- [IT User Access Review](../../corpus/it-user-access-review.md) — the
  generic corpus's synthetic version of the credential-termination-timing
  risk this real report found in practice.
- [Cloud Computing Controls Testing](../../corpus/cloud-computing-controls-testing.md) —
  covers the logical-access side of third-party/shared-infrastructure
  risk this physical data-center finding complements.
