---
layout: default
title: Duplicate Vendor Payment Checker
---

# Duplicate Vendor Payment Checker

**Objective**: Identify duplicate or erroneous vendor payments using a combination of fuzzy matching and rules-based logic for audit testing of the Procure-to-Pay (P2P) process.

## 🔍 Audit Context

Duplicate payments are a known financial risk and SOX concern, often arising from:
- Slight differences in vendor names
- Reused invoice numbers across systems
- Manual entry or OCR extraction errors

Internal Audit needed an automated approach to flag potential duplicates without relying on exact matching.

## 🛠 Techniques Used

- **Fuzzy string matching**: Levenshtein and Jaccard similarity
- **SQL logic**: invoice amount, date proximity, PO reuse
- **Threshold tuning**: adjustable scoring for match tolerance
- **Entity resolution**: grouped similar vendor names

## 🧪 Tools

- Python (`fuzzywuzzy`, `pandas`, `recordlinkage`)
- SQL (Snowflake & PostgreSQL tested)
- Jupyter Notebook for logic walkthrough
- Optional Power BI/Looker visual layer

## 🔁 Matching Logic

- Vendors with similarity > 90%
- Invoices with same amount ± 1 cent
- Date within 5-day window
- Duplicate invoice # on different vendor name

## 🧪 Sample Output

| Invoice | Vendor A           | Vendor B             | Amount | Date Diff | Fuzzy Score | Duplicate? |
|---------|--------------------|----------------------|--------|-----------|-------------|------------|
| 221984  | Acme Corp          | Acme Corporation     | $12,450| 2 days    | 92          | ✅         |
| 773982  | Global Data Group  | GlobalData LLC       | $3,000 | 1 day     | 88          | ⚠️ Review  |

## 💡 Business Value

- Flagged $230K+ in potential duplicate payments in FY24
- Enabled sampling of matched transactions for audit walkthroughs
- Integrated with SOX control testing templates
- Recommended automated duplicate check before AP submission

## 📂 Repo Artifacts

- 📁 `notebooks/duplicate_payment_check.ipynb`
- 📁 `data/vendor_payments_sample.csv`
- 📁 `scripts/fuzzy_dedupe.py`, `sql/dup_check_template.sql`

---

🔗 [Back to Home](../index.md)
