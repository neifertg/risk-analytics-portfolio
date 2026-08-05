---
id: it-change-management-testing
title: IT Change Management Testing
type: procedure
summary: >
  Tests whether changes to financially significant systems are approved,
  tested, and segregated from production access before deployment, and
  whether emergency changes get the same rigor applied after the fact
  rather than skipped entirely.
---

# IT Change Management Testing

## Scope

Covers code, configuration, and infrastructure changes to systems in
scope for [IT User Access Review](it-user-access-review.md) — the ERP,
financial-reporting systems, and any system feeding a SOX-relevant
control. A change to an out-of-scope internal tool doesn't require the
same evidence trail even if it follows the same underlying process.

## Standard Change Testing

Sample changes deployed during the period and confirm each has a
documented business or technical justification, evidence of testing
(test plan and results, or user acceptance sign-off) prior to
deployment, and approval from someone independent of the developer who
made the change. A change deployed without a corresponding approved
change ticket is a finding regardless of whether the change itself was
technically sound — the control being tested is the process, not the
outcome.

## Segregation Between Development and Production

Confirm developers cannot deploy their own code directly to the
production environment without an independent release step, and that
access to move code between environments is limited to a release-
management function separate from the development team. Where a
developer does hold production access for support reasons, confirm
compensating controls exist — logged and reviewed production activity,
at minimum — since the segregation gap can't simply be waived.

## Emergency Change Testing

Sample changes logged through the emergency/expedited change process
(deployed before normal approval to resolve an active incident) and
confirm each received the required retroactive approval within the
policy's window (commonly 24-48 hours) and a documented incident
justifying the bypass. A pattern of changes routed through the emergency
process that don't correspond to an actual incident is a sign the
standard process is being circumvented for convenience, not urgency.

## Related

- [IT User Access Review](it-user-access-review.md)
- [SOX 404 Key Controls Walkthrough](sox-404-key-controls-walkthrough.md)
