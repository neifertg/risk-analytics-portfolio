<button id="toggle-dark" style="position:fixed;top:1rem;right:1rem;z-index:1000;">🌙 Toggle Dark Mode</button>
<style>
body.dark-mode {
  background: #181a1b !important;
  color: #e8e6e3 !important;
}
body.dark-mode a { color: #8ab4f8 !important; }
body.dark-mode h1, body.dark-mode h2, body.dark-mode h3,
body.dark-mode h4, body.dark-mode h5, body.dark-mode h6 { color: #fff !important; }
body.dark-mode blockquote {
  border-left: 4px solid #444;
  color: #b0b0b0;
  background: #232526;
}
body.dark-mode hr { border-color: #333; }
</style>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('toggle-dark');
    const setMode = (on) => {
      document.body.classList.toggle('dark-mode', on);
      localStorage.setItem('darkMode', on ? '1' : '');
    };
    btn.onclick = () => setMode(!document.body.classList.contains('dark-mode'));
    // On load
    if (localStorage.getItem('darkMode')) setMode(true);
  });
</script>

---
layout: home
title: "Risk & Audit Analytics Portfolio"
description: "Data-driven internal audit, risk analytics, and automation projects by G. Seth Neifert"
---

# Welcome to My Risk & Audit Analytics Portfolio

I work in internal audit data analytics and am building toward applying
advanced analytics, machine learning, and automation to internal audit,
enterprise risk, and governance challenges. This site tracks real, working
projects as they ship — nothing here is a mockup or a hypothetical.

---

## 🔍 Projects

### Audit Procedures RAG Assistant

A retrieval-augmented question-answering assistant grounded in a
synthetic internal-audit procedures corpus — two-stage retrieval, a
groundedness guardrail that declines to answer rather than guess, and
full query logging. Includes a real debugging story: two retrieval bugs
found live by actually running the eval suite against real embeddings
(boilerplate cross-reference sections winning on title overlap, and a
section whose own opening sentence diluted its embedding), both
root-caused and fixed — see the project README.

[Source & write-up](https://github.com/neifertg/risk-analytics-portfolio/tree/main/audit-rag-assistant)
&middot; [Live demo](https://84abkcnqvptyedbbssztx8.streamlit.app/)

### Benford's Law Analyzer

Checks whether real, public financial-statement data conforms to
Benford's Law's expected leading-digit distribution — a classic
forensic-accounting screening technique. Run against ~6,400 real US
public companies' reported total assets (SEC EDGAR XBRL Frames API, no
synthetic data): chi-square p=0.20, Nigrini MAD=0.00324 (close
conformity) — the expected result for a healthy market-wide aggregate,
and a validated baseline for applying the same method to a narrower,
single-entity population where a deviation would actually be meaningful.

[Source, chart & real output](https://github.com/neifertg/risk-analytics-portfolio/tree/main/benfords-law-analyzer)

### Duplicate Vendor Payment Checker

Flags potential duplicate AP payments using four named, real audit
techniques (exact duplicates, threshold-avoidance "split" payments,
fuzzy-matched vendor-master duplicates, and lower-confidence review
candidates) rather than one opaque similarity score. Run against a
seeded synthetic ledger (919 payments, ground truth kept separate from
the detector's input): 98% recall, 100% precision — including one
honestly-reported miss where a vendor-name variant fell just short of
the fuzzy-match threshold, a real precision/recall tradeoff rather than
a hidden flaw.

[Source, findings & real output](https://github.com/neifertg/risk-analytics-portfolio/tree/main/duplicate-vendor-payment-checker)

---

## 📄 Contact

- [GitHub](https://github.com/neifertg)
- [LinkedIn](https://www.linkedin.com/in/g-seth-neifert-7668b6b6/)
- [Email](mailto:gsneifert@gmail.com)

---

> "Better data leads to better questions. Better questions lead to better audits."

