---
id: it-user-access-review
title: IT User Access Review
type: procedure
summary: >
  Periodic review of who has access to financially significant systems,
  testing new-access provisioning, timely termination/transfer
  deprovisioning, and privileged/admin access against least-privilege
  and segregation-of-duties expectations.
---

# IT User Access Review

## Scope

Covers user access to systems that support financial reporting or
process financial transactions — the ERP, treasury/banking platforms,
and any system feeding a SOX-relevant control. Access reviews for systems
outside this scope may still matter for security purposes but aren't part
of the ICFR-relevant review.

## New Access Provisioning

Sample new user access grants during the period and confirm each was
requested through the formal access-request process, approved by the
requesting employee's manager and (for financially sensitive roles) by
the relevant system/data owner, and that the access granted matches what
was actually approved — not a broader role assigned for convenience.
Access that exceeds what was approved is a finding even if it was never
misused; the control being tested is the provisioning process, not
whether harm resulted.

## Termination and Transfer Deprovisioning

Compare the HR termination/transfer report for the period against system
access logs to confirm access was removed or adjusted within the policy's
required window (commonly 24-48 hours for terminations). A terminated
employee who retains system access even briefly is a significant finding,
since it's exactly the population most likely to have both motive and a
narrowing window of opportunity. Internal transfers need equal attention:
access from the old role should be removed, not just supplemented with
access for the new one, or the employee accumulates access across roles
over time.

## Privileged Access and Segregation of Duties

Review the list of users with administrative or privileged access
(ability to bypass application controls, directly modify data, or grant
access to others) and confirm the population is limited to roles that
genuinely require it, each has a documented business justification, and
no privileged user also holds an incompatible transactional role — e.g.
someone who can both create vendors and approve payments. Privileged
access should also be logged and periodically reviewed by someone other
than the privileged user.

## Related

- [Segregation of Duties Review](segregation-of-duties-review.md)
- [SOX 404 Key Controls Walkthrough](sox-404-key-controls-walkthrough.md)
