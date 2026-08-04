# Benford's Law Analyzer

Checks whether a set of real, public financial-statement values conforms
to Benford's Law — the observation that in many naturally-occurring
numeric datasets, the leading digit isn't uniformly distributed: it's `1`
about 30% of the time, `9` less than 5%, following `P(d) = log₁₀(1 + 1/d)`.
Deviation from that expected curve is a classic forensic-accounting
screening signal — not proof of anything on its own, but a place to look
closer.

## Data

SEC EDGAR's [XBRL Frames API](https://www.sec.gov/edgar/sec-api-documentation)
(`data.sec.gov`, free, no API key) — every public company's reported
**Total Assets** (`us-gaap:Assets`, USD) for the same instantaneous period,
**CY2023Q4I**, in one request. No synthetic or invented data anywhere in
this analysis.

## Method

1. Pull all reported values for the period (`analyze.py` → `fetch_values`).
2. Drop non-positive values — Benford's Law assumes naturally-occurring
   positive magnitudes with no artificial bound; a handful of filers
   report zero or negative total assets (shell companies, restatements).
3. Extract each value's leading digit.
4. Compare the observed leading-digit frequency distribution to Benford's
   expected distribution two ways:
   - **Chi-square goodness-of-fit test** — standard statistical test, but
     its p-value shrinks as sample size grows, so on a dataset this large
     it can flag trivial deviations as "significant."
   - **Nigrini's MAD (Mean Absolute Deviation)** — the metric actually
     used in forensic-accounting practice, with established conformity
     thresholds independent of sample size (Nigrini, *Benford's Law:
     Applications for Forensic Accounting, Auditing, and Fraud Detection*,
     2012): `<0.006` close conformity, `<0.012` acceptable, `<0.015`
     marginal, `≥0.015` nonconformity.

## Findings (real output, `output/results.json` / `output/chart.png`)

Run against `us-gaap:Assets`, CY2023Q4I:

| Metric | Value |
|---|---|
| Filers returned | 6,428 |
| Positive values analyzed | 6,395 (33 excluded, non-positive) |
| Chi-square statistic | 11.021 |
| Chi-square p-value | 0.201 |
| MAD | 0.00324 |
| Nigrini conformity | **Close conformity** |

The leading-digit distribution of total assets across ~6,400 real US
public companies tracks Benford's expected curve closely (see
`output/chart.png`) — chi-square doesn't reject the null hypothesis
(p=0.20, well above 0.05), and MAD lands in Nigrini's "close conformity"
band.

**What this result actually means, stated plainly**: this is the
*expected*, unsurprising outcome for a large, healthy, market-wide
aggregate — it's not a fraud finding, and it isn't meant to be one. A
single well-known company reporting one metric, aggregated across
thousands of independent filers, is exactly the kind of large, organic
dataset Benford's Law describes well. This run validates that the
methodology and code are correct — the "no anomaly" result you'd want to
see before trusting the same tool on a *narrower* population where a
deviation would actually be meaningful: one company's vendor-payment
ledger, one entity's expense report population, or one filer's data
across many periods rather than many filers in one period. That's the
natural next extension, not built here.

## Running it

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # Windows; .venv/bin/pip on macOS/Linux
.venv/Scripts/python analyze.py
```

Writes `output/results.json` (the real computed statistics) and
`output/chart.png` (observed vs. expected bar chart).
