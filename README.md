# Risk & Audit Analytics Portfolio

Real, working internal-audit and risk-analytics projects — data-driven
detection techniques, an LLM-based assistant, and honest write-ups of what
broke and how it was fixed. Nothing here is a mockup.

**[View the live site →](https://neifertg.github.io/risk-analytics-portfolio/)**

## Projects

### [Audit Procedures RAG Assistant](audit-rag-assistant/)

A retrieval-augmented question-answering assistant grounded in a synthetic
internal-audit procedures corpus — two-stage retrieval, a groundedness
guardrail that declines to answer rather than guess, and full query
logging. Includes a real debugging story: two retrieval bugs found live by
running the eval suite against real embeddings, both root-caused and
fixed.

[Source & write-up](audit-rag-assistant/) ·
[Live demo](https://84abkcnqvptyedbbssztx8.streamlit.app/)

### [Benford's Law Analyzer](benfords-law-analyzer/)

Checks whether real, public financial-statement data conforms to Benford's
Law's expected leading-digit distribution — a classic forensic-accounting
screening technique. Run against ~6,400 real US public companies' reported
total assets (SEC EDGAR XBRL Frames API, no synthetic data): chi-square
p=0.20, Nigrini MAD=0.00324 (close conformity).

[Source, chart & real output](benfords-law-analyzer/)

### [Duplicate Vendor Payment Checker](duplicate-vendor-payment-checker/)

Flags potential duplicate AP payments using four named, real audit
techniques (exact duplicates, threshold-avoidance "split" payments,
fuzzy-matched vendor-master duplicates, and lower-confidence review
candidates) rather than one opaque similarity score. Run against a seeded
synthetic ledger (919 payments, ground truth kept separate from the
detector's input): 98% recall, 100% precision.

[Source, findings & real output](duplicate-vendor-payment-checker/)

## Contact

- [GitHub](https://github.com/neifertg)
- [LinkedIn](https://www.linkedin.com/in/g-seth-neifert-7668b6b6/)
- [Email](mailto:gsneifert@gmail.com)
</content>
