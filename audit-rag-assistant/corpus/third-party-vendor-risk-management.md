---
id: third-party-vendor-risk-management
title: Third-Party Vendor Risk Management
type: procedure
summary: >
  Tests whether vendors are risk-tiered before onboarding, whether
  due-diligence evidence (financial, security, compliance) matches the
  assigned tier, and whether ongoing monitoring actually continues after
  onboarding rather than stopping once the contract is signed.
---

# Third-Party Vendor Risk Management

## Distinct From Vendor Master Data Controls

This tests vendor *risk* — financial stability, data-security posture,
regulatory/compliance exposure — separately from the payment-fraud
controls covered in [Vendor Master Data Control
Testing](vendor-master-data-control-testing.md). A vendor can pass every
vendor-master control (proper approval, no duplicate, no fraud
indicator) and still be a significant risk if it processes sensitive
data or is financially unstable; this procedure is what's supposed to
catch that.

## Risk Tiering at Onboarding

Sample vendors onboarded during the period and confirm each was assigned
a risk tier based on documented criteria — data access level, financial
spend, criticality to operations, regulatory exposure — before, not
after, the due-diligence work was scoped. A vendor tiered as low-risk
without a documented basis for that tier is itself a finding, since the
tier determines how much due diligence everything downstream receives.

## Due Diligence Evidence Matching the Tier

For higher-tier vendors, confirm the file contains evidence proportional
to the assigned risk: a current SOC 1 or SOC 2 report (or equivalent)
for vendors with system access or data-processing responsibilities,
evidence of financial-stability review for vendors representing
significant spend concentration, and confirmation of required insurance
coverage. A SOC 2 report older than the vendor's own reporting cycle
(commonly 12 months) on file at onboarding time is effectively no
evidence at all and should be treated as a gap.

## Ongoing Monitoring, Not Just Onboarding

Sample higher-tier vendors from prior periods and confirm due-diligence
evidence has actually been refreshed on the required cadence, not just
collected once at onboarding and never revisited. Test whether a vendor
that experienced a security incident or public financial distress during
the period was re-assessed and, where warranted, re-tiered — the
monitoring control is only meaningful if it responds to new information,
not just calendar-driven renewal paperwork.

## Related

- [Vendor Master Data Control Testing](vendor-master-data-control-testing.md)
- [Data Privacy Compliance Testing](data-privacy-compliance-testing.md)
