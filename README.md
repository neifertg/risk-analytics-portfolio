# Risk & Audit Analytics Portfolio

[![CI](https://github.com/neifertg/risk-analytics-portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/neifertg/risk-analytics-portfolio/actions/workflows/ci.yml)

Real, working internal-audit and risk-analytics projects — detection
techniques, sampling and access analytics, an LLM assistant, a multi-agent
co-pilot over those tools, and honest write-ups of what broke and how it
was fixed. Nothing here is a mockup.

**[View the live site →](https://neifertg.github.io/risk-analytics-portfolio/)**

## Projects

### [Audit Engagement Co-Pilot](audit-engagement-co-pilot/)

**Problem:** An engagement question often needs a sampling answer, a
fraud-risk answer, and a standards answer together, and those answers can
disagree.

**Result:** A supervisor routes each part to the specialist that already
owns it (over a real MCP server wrapping five other projects here) and
states the disagreement in the final answer. Multi-agent eval is 6/6:
dispatch discipline, the synthetic-data caveat showing up in the answer,
fan-out reconciliation, and an induced sampling failure that degrades to
an explanation instead of crashing.

[Source](audit-engagement-co-pilot/) ·
[Live demo](https://audit-engagement-co-pilot.onrender.com) (free-tier hosting; may take ~30–60s to wake up)

### [Audit Procedures RAG Assistant](audit-rag-assistant/)

**Problem:** Procedure questions should be answered from the procedures,
and a weak retrieval should be a decline rather than a guess.

**Result:** Two-stage retrieval over a synthetic audit-procedures corpus,
with citations and a groundedness guardrail. Eval suite is 28/28, including
two retrieval bugs found by running it (boilerplate "Related" sections
winning on title overlap, and a section whose opening sentence diluted its
own embedding) and then fixed.

[Source](audit-rag-assistant/) ·
[Live demo](https://84abkcnqvptyedbbssztx8.streamlit.app/) (free-tier hosting; may take ~30–60s to wake up)

### [Benford's Law Analyzer](benfords-law-analyzer/)

**Problem:** A Benford screen is only a lead, and only if you know what
conforming data looks like on real filings.

**Result:** ~6,400 real US public companies' reported total assets (SEC
EDGAR, CY2023Q4I, no synthetic data): chi-square p=0.201, Nigrini
MAD=0.00324, close conformity. The expected result for a healthy
market-wide aggregate, and a baseline for a narrower population where a
deviation would mean something.

[Source](benfords-law-analyzer/)

### [Duplicate Vendor Payment Checker](duplicate-vendor-payment-checker/)

**Problem:** Duplicate AP payments show up as exact repeats, invoices split
under an approval threshold, lookalike vendor-master records, or
same-amount pairs that only deserve a review.

**Result:** Four named checks on a seeded ledger of 919 payments (ground
truth kept out of the detector): 51 of 52 planted cases caught (98%
recall), 100% precision. The one miss was `"Lumen Utilities"` vs.
`"Lumen Utilities LLC"` at an 88.2% fuzzy match, just under the 90% cutoff.

[Source](duplicate-vendor-payment-checker/)

### [Duplicate Payment Anomaly Detection](duplicate-payment-anomaly-detection/)

**Problem:** The same duplicate-payment question, with the hand-built rules
removed, to see what a general anomaly model recovers and what it costs in
false positives.

**Result:** On the same 919-payment ledger, Isolation Forest was 47.8%
precision and 41.1% recall (about 4× an 11.6% true anomaly rate). DBSCAN
was 41.2% precision and 19.6% recall. The four named checks on this ledger
were 100% precision and 98.1% recall. The gap is the expected one.

[Source](duplicate-payment-anomaly-detection/)

### [Journal Entry Testing Analyzer](journal-entry-testing-analyzer/)

**Problem:** AU-C 240 and PCAOB AS 2401 require a separate test of journal
entries for fraud risk, and a reviewer needs to see which criterion fired.

**Result:** Five criteria (unusual preparer, weekend/holiday posting,
period-end cutoff, round-dollar with a weak description, unusual account
combination) on a seeded ledger of 2,586 entries and 86 planted flags:
100% recall. Four criteria were also 100% precise. Period-end cutoff was
9.6% precise, because ordinary month-end activity falls in that window.
Overall precision was 27%.

[Source](journal-entry-testing-analyzer/)

### [Segregation-of-Duties Conflict Checker](sod-conflict-checker/)

**Problem:** A role catalog can look clean while one person currently holds
both sides of a conflict, through a legacy role or an exception grant that
is still active.

**Result:** 220 synthetic users, scored on current access rather than grant
history: 24/24 active conflicts caught (100% recall and precision) and
10/10 revoked-access users left unflagged. One user had accumulated all
three procure-to-pay rights (create, approve, and receive) from two
independent grants.

[Source](sod-conflict-checker/)

### [Statistical Audit Sampling Calculator](sampling-calculator/)

**Problem:** Attribute and monetary-unit sample sizes have to match the
AICPA reliability-factor tables auditors already use.

**Result:** The chi-square form of the reliability factor matches 10
published AICPA/PPS values within 0.0074. Worked examples on illustrative
populations: a 156-item attribute sample of PO approvals found 2 deviations
and a 4.04% upper deviation rate, under a 5% tolerable rate; a PPS sample
of a $4,587,449 AR balance selected one seeded overstatement and an upper
misstatement limit of $134,166, over the $115,000 tolerable amount, so the
balance is not supported. Nonzero-expected-misstatement MUS planning uses a
conservative approximation, not the guide's expansion-factor sub-table.

[Source](sampling-calculator/)

### [Presentation Deck Builder](deck-builder/)

**Problem:** Internal-audit training decks drift when every talk is
hand-built HTML and CSS.

**Result:** Content is a `deck.yaml`; shared layouts and tokens render a
self-contained reveal.js file. Two real decks are in the repo: a 16-slide
anomaly-detection training deck (Isolation Forest, Local Outlier Factor,
One-Class SVM, autoencoders, closing on a four-step pilot) and a 17-slide
clustering deck (K-Means, hierarchical clustering, DBSCAN, Gaussian mixture
models). Both are static files on GitHub Pages, so they don't have a
cold start.

[Source](deck-builder/) ·
[Anomaly-detection deck](https://neifertg.github.io/risk-analytics-portfolio/deck-builder/decks/anomaly-detection-for-internal-audit/index.html) ·
[Clustering deck](https://neifertg.github.io/risk-analytics-portfolio/deck-builder/decks/clustering-for-audit/index.html)

### [Ames Housing Price Prediction](ames-housing-price-prediction/)

**Problem:** Applied-ML practice, not an audit test: predict sale price
from structural and quality features, and notice when the metric changes
the winner.

**Result:** Real Kaggle Ames data, 1,460 homes, 80/20 holdout. Random
Forest had the lowest RMSE (0.148) and the highest R² (0.883). Lasso had
the lowest dollar error ($16,754 MAE, versus Random Forest's $17,595).
Ridge was in between (RMSE 0.153, MAE $17,080).

[Source](ames-housing-price-prediction/)

### [IMDB Review Text Analytics](imdb-review-text-analytics/)

**Problem:** Applied text analytics, not an audit test: classical NLP on
real reviews, including a check the original coursework set up and never
finished — scoring sentiment against the labels.

**Result:** 5,000 real IMDB reviews. A Naive Bayes classifier reached
83.1% accuracy (84.1% precision, 81.6% recall) on a 1,500-review holdout.
A lexicon "net score > 0" rule reached 71.9% against the same labels.

[Source](imdb-review-text-analytics/)

## Contact

- [GitHub](https://github.com/neifertg)
- [LinkedIn](https://www.linkedin.com/in/g-seth-neifert-7668b6b6/)
- [Email](mailto:gsneifert@gmail.com)
