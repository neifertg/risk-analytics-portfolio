---
id: cloud-computing-controls-testing
title: Cloud Computing Controls Testing
type: procedure
summary: >
  Tests whether the organization has correctly identified which controls
  it owns versus which it's relying on the cloud provider for, whether
  cloud identity and access configuration is actually reviewed rather
  than left at default settings, and whether reliance on a provider's
  SOC 2 report is based on reading it rather than just filing it.
---

# Cloud Computing Controls Testing

## Scope

Covers systems hosted on third-party cloud infrastructure (IaaS, PaaS, or
SaaS), where the organization does not control the full technology stack
directly. Access provisioning/deprovisioning mechanics within a cloud-
hosted application are still tested under [IT User Access
Review](it-user-access-review.md); this procedure covers what's distinct
about the cloud layer itself — the responsibility boundary, cloud-native
identity configuration, and vendor attestation reliance.

## Shared Responsibility Boundary Confirmation

For each in-scope cloud service, confirm the organization has documented
which controls the provider is responsible for versus which remain the
organization's own responsibility, and that this boundary matches the
provider's current published shared-responsibility model for that
specific service — not a generic assumption carried over from a
different service or provider. An organization that assumes the provider
"handles security" for a control that's actually the customer's
responsibility under that service's model (most commonly: data and
identity access management, which stays with the customer under every
service model) has a gap that looks invisible until something goes wrong,
since no one — provider or customer — was actually testing it.

## Cloud Identity and Access Configuration Testing

Independent of application-level user access review, test the
configuration of the cloud platform's own administrative identity layer:
confirm multi-factor authentication is enforced on all accounts with
administrative or root-level privilege, that root/owner-level credentials
are not used for routine daily administration, and that a sample of
privileged cloud roles matches a documented, approved list rather than
having accumulated informally over time. A root account without MFA
enforced is a finding regardless of how well-controlled the applications
running on top of that cloud environment are, since compromising that one
account can bypass every control built into those applications.

## Vendor Attestation Reliance

Where the organization relies on a cloud provider's SOC 2 or equivalent
attestation report in place of testing the provider's controls directly
(see [Third-Party Vendor Risk Management](third-party-vendor-risk-management.md)
for the broader due-diligence process), confirm the report was actually
read, not just collected: that its scope covers the specific service in
use, that any noted exceptions were evaluated for relevance, and that
subservice organizations carved out of the report's scope (a data-center
provider one layer removed, for instance) were separately considered
rather than assumed covered. A SOC 2 report on file that doesn't actually
cover the service being relied on provides no assurance despite giving
the appearance of due diligence having been performed.

## Related

- [IT User Access Review](it-user-access-review.md)
- [Third-Party Vendor Risk Management](third-party-vendor-risk-management.md)
