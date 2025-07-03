---
layout: default
title: Privileged Access Monitoring Dashboard
---

# Privileged Access Monitoring Dashboard

**Objective**: Implement a continuous auditing solution to identify risk concentrations in user access to privileged systems.

## 🔍 Audit Context

Excessive or misaligned privileged access is a common root cause of control failures in IT General Controls (ITGCs), identity governance, and SOX audits. Traditional reviews (e.g., quarterly recertifications) often miss toxic access combinations or dormant privileged accounts.

This project automates access risk detection using user-level data from Active Directory, entitlement exports, and HR roles.

## 🛠 Techniques Used

- **Role classification**: Bucket users as admin, service accounts, third-party, or standard based on naming patterns and metadata
- **Aggregation**: Count users by entitlement, role, and application
- **Anomaly detection**: Flag entitlements with:
  - High concentrations of privileged users
  - Excess third-party or dormant access
  - Unusual access combinations

## 🧪 Tools

- `R` + `Shiny` for the interactive dashboard
- `tidyverse` + `lubridate` for ETL
- `plotly` for interactive charts

## 📊 Dashboard Features

- Filters for system, user type, and role
- Heatmaps of privileged access by app
- Trendline of access growth over time
- Export to Excel/PDF for audit evidence

![Access Risk Heatmap](/assets/priv-access-heatmap.png)

## 💡 Business Value

- Supported Internal Audit reviews of 5 critical platforms
- Reduced manual entitlement testing by 60%
- Flagged 25+ dormant service accounts with admin rights
- Framework adopted into quarterly continuous audit monitoring

## 📂 Repo Artifacts

- 📁 `R/entitlement_cleaning.R`
- 📁 `app/ui.R`, `app/server.R`
- 📁 `data/privileged_user_counts.csv`

## 📎 Sample Output Table

| Entitlement | Role         | Users | Dormant Accounts | Flag |
|-------------|--------------|-------|------------------|------|
| SYS_ADMIN   | Service Acct | 8     | 3                | ✅   |
| DB_READ     | Third Party  | 14    | 1                | ⚠️   |
| ROOT        | Admin        | 2     | 0                | ✅   |

---

🔗 [Back to Home](../index.md)
