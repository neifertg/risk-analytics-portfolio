---
layout: default
title: NLP-Based Risk Classification of IT Incidents
---

# NLP-Based Risk Classification of IT Incidents

**Objective**: Use natural language processing (NLP) and supervised machine learning to detect potential misclassification of risk levels in IT incident tickets.

## 🔍 Audit Context

Internal Audit reviewed high-priority incident management and noticed inconsistencies in how teams assigned “High” or “Critical” risk levels. Manual reviews were slow and reactive.

This project builds a model to predict risk level based on free-text descriptions and compares it to the assigned value — highlighting anomalies for deeper audit review.

## 🛠 Techniques Used

- **Text preprocessing**: tokenization, stopword removal, lemmatization
- **Vectorization**: TF-IDF applied to short descriptions and incident notes
- **Modeling**: XGBoost classifier with risk level as the target
- **Explainability**: SHAP values to explain predictions and uncover bias

## 🧪 Tools

- `Python` (scikit-learn, XGBoost, pandas)
- `spaCy` for NLP preprocessing
- `SHAP` for model interpretability
- Jupyter Notebooks

## 🧠 Model Results

- 82% accuracy on validation set
- High SHAP impact from terms like:
  - “outage,” “root access,” “customer data”
- Helped isolate misclassified medium-risk tickets containing high-severity indicators

## 📊 Visualization

![SHAP Feature Importance](/assets/incident-nlp-shap.png)

## 🧪 Sample Flagged Tickets

| Ticket ID | Description                                  | Assigned Risk | Predicted Risk | Flag |
|-----------|----------------------------------------------|---------------|----------------|------|
| INC473921 | Database outage affecting production apps    | Medium        | High           | ✅   |
| INC489032 | User reported issue with local printer setup | High          | Low            | ⚠️   |

## 💡 Business Value

- Enabled audit to sample targeted false-negatives and false-positives
- Identified 30+ incidents misclassified over 6 months
- Informed IA’s recommendation for revised risk tagging policy
- Prototype integrated into GRC analytics dashboard

## 📂 Repo Artifacts

- 📁 `notebooks/nlp_risk_model.ipynb`
- 📁 `data/incidents_train.csv`, `data/incidents_val.csv`
- 📁 `scripts/preprocess_text.py`, `scripts/train_model.py`

---

🔗 [Back to Home](../index.md)
