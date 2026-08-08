---
id: it-general-controls-overview
title: IT General Controls Overview
type: procedure
summary: >
  Frames IT general controls as the four-domain foundation (access,
  change, development, operations) that gates reliance on every
  automated application control, and covers the two domains — system
  development and computer operations — not addressed by this corpus's
  dedicated access-review and change-management procedures.
---

# IT General Controls Overview

## Scope and Relationship to Other Procedures

IT general controls (ITGC) govern an IT environment as a whole rather
than any single application running on top of it, and this corpus splits
ITGC testing across four procedures by domain. Access controls are
covered in [IT User Access Review](it-user-access-review.md) and change
controls in [IT Change Management Testing](it-change-management-testing.md)
— this procedure exists to (a) state the four-domain frame those two sit
inside, and (b) cover the remaining two domains, system development and
computer operations, that don't have a dedicated procedure elsewhere in
this corpus.

## Why ITGC Gates Reliance on Application Controls

An automated application control — a system-enforced approval limit, a
three-way match, a validation rule — is only as trustworthy as the IT
environment it runs in. If access controls are weak, someone may be able
to bypass the control outside the normal interface; if change management
is weak, someone may alter the control's underlying logic without
detection; if operations are weak, the job enforcing the control may
silently fail to run. A deficiency in any one ITGC domain doesn't just
flag a gap in that domain — it undermines the evidentiary weight of every
automated application control that depends on the environment underneath
it, which is why ITGC testing is scoped and evaluated before, not
alongside, application-control testing for a given system.

## System Development Life Cycle Testing

Sample new systems or major system enhancements implemented during the
period and confirm each followed a defined system development life cycle
(SDLC): documented requirements, a testing phase distinct from
development, formal user acceptance testing (UAT) sign-off from the
business owner, and a controlled go-live rather than an informal cutover.
A system that skipped UAT because the go-live date was under schedule
pressure is a finding even if the system has run without incident since
launch — the control being tested is whether the process that's supposed
to catch defects before production actually ran, not whether a defect
happened to surface later.

## Computer Operations Testing

Sample scheduled batch jobs critical to financial processing (interface
feeds, period-close jobs, automated reconciliations) and confirm job
failures during the period were detected and resolved within a defined
SLA, not discovered downstream when a report failed to tie out. Separately,
sample a backup restoration test performed during the period and confirm
it actually restored usable data — a backup job that reports "success" but
has never been test-restored provides no real assurance that recovery
would work if it were ever needed, which is the entire point of the
control.

## Related

- [IT User Access Review](it-user-access-review.md)
- [IT Change Management Testing](it-change-management-testing.md)
