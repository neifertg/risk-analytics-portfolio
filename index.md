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

I specialize in applying advanced analytics, machine learning, and automation to internal audit, enterprise risk, and governance challenges. My work bridges the gap between compliance objectives and cutting-edge data science.

---

## 🔍 Featured Projects

### [Privilege Access Monitoring (R Shiny)](/projects/privileged-access-monitoring.md)
- Role-based user access audits
- Outlier detection & visualizations

### [Misclassified Incident Risk (NLP + XGBoost)](/projects/incident-risk-nlp.md)
- Natural language processing of service tickets
- ML classification of high-risk mislabels

### [Duplicate Vendor Payment Checker (Python + SQL)](/projects/duplicate-vendor-checker.md)
- Entity resolution and fuzzy logic
- Transaction sampling for audit fieldwork

### [Model Bias Detection (SHAP + Governance Alerts)](/projects/model-bias-detection)
- Interpretability tools for audit of machine learning models
- Alerts for control effectiveness

---

## 🧠 Advanced Techniques

- [Text Analytics & NLP for Risk](/techniques/nlp-risk)
- [Outlier Detection Methods](/techniques/outlier-detection)
- [Benford’s Law & Distribution Analysis](/techniques/benfords-law)
- [Fuzzy Matching & Entity Resolution](/techniques/fuzzy-matching)
- [Continuous Monitoring Pipelines](/techniques/monitoring)

---

## 📖 Recent Blog Posts

- *[How NLP Is Revolutionizing Internal Audit Logs](/blog/nlp-audit-logs)*
- *[Top 5 SQL Techniques for Audit Sampling](/blog/sql-audit-sampling)*
- *[Designing a Risk Analytics Function from Scratch](/blog/building-risk-analytics)*

---

## 📄 Resume + Contact

- [View Resume (PDF)](/assets/GSN_resume.pdf)
- [LinkedIn](https://www.linkedin.com/in/gsethneifert)
- [Email](mailto:sethneifert@example.com)
- [GitHub](https://github.com/yourusername)

---

> "Better data leads to better questions. Better questions lead to better audits."

