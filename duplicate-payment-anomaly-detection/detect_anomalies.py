"""Unsupervised anomaly detection on AP payments, evaluated against the same
seeded ground truth the sibling duplicate-vendor-payment-checker project
uses for its rule-based heuristics.

The point isn't to "beat" the rules — four hand-built heuristics tuned to
four specific seeded patterns should, and do, win on precision. The point
is a real, honest comparison: can general-purpose statistical anomaly
detection (no domain rules, no thresholds hand-picked for these patterns)
recover a meaningful share of the same real cases, and what does it cost in
false positives? That trade-off is exactly what
resources/audit-analytics-tooling-landscape.md's transparency/defensibility
framing is about.

Ground truth is used only for evaluation and for the light, disclosed
threshold search — never as an input feature to either detector.
"""

import json
from itertools import combinations
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from rapidfuzz import fuzz
from sklearn.cluster import DBSCAN
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.metrics import confusion_matrix, f1_score, precision_score, recall_score
from sklearn.preprocessing import StandardScaler

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_DIR = Path(__file__).parent / "output"
RANDOM_STATE = 42
# A round, domain-judgment estimate of "how much of a ledger might warrant
# review" — not the true seeded rate (11.6%), which would be a label leak
# into an otherwise-unsupervised method's primary configuration.
ASSUMED_ANOMALY_RATE = 0.10


def load_data():
    ledger = pd.read_csv(DATA_DIR / "ledger.csv", parse_dates=["payment_date"])
    ground_truth = json.loads((DATA_DIR / "ground_truth.json").read_text())
    flagged_ids = set()
    for group in ground_truth:
        flagged_ids.update(group["payment_ids"])
    ledger["true_anomaly"] = ledger["payment_id"].isin(flagged_ids).astype(int)
    return ledger, ground_truth


def vendor_fuzzy_scores(vendor_names):
    """Max fuzzy-match score of each vendor name against every OTHER
    distinct vendor name — a continuous version of the sibling project's
    hard 90%-threshold vendor-master-duplicate check."""
    unique_vendors = sorted(set(vendor_names))
    best = {v: 0 for v in unique_vendors}
    for a, b in combinations(unique_vendors, 2):
        score = fuzz.token_sort_ratio(a, b)
        best[a] = max(best[a], score)
        best[b] = max(best[b], score)
    return best


def build_features(ledger):
    df = ledger.copy()

    vendor_counts = df.groupby("vendor_name")["payment_id"].transform("count")
    df["vendor_payment_count"] = vendor_counts

    same_amount_counts = df.groupby(["vendor_name", "amount"])["payment_id"].transform(
        "count"
    )
    df["same_vendor_same_amount_count"] = same_amount_counts - 1  # exclude self

    vendor_mean = df.groupby("vendor_name")["amount"].transform("mean")
    vendor_std = df.groupby("vendor_name")["amount"].transform("std").fillna(0)
    df["amount_zscore_within_vendor"] = np.where(
        vendor_std > 0, (df["amount"] - vendor_mean) / vendor_std, 0.0
    )

    df["log_amount"] = np.log1p(df["amount"])

    min_gap_days = []
    for vendor, group in df.groupby("vendor_name"):
        dates = group["payment_date"].sort_values().to_numpy()
        if len(dates) < 2:
            gaps = {group.index[0]: 9999}
        else:
            gaps = {}
            for idx, i in enumerate(group.sort_values("payment_date").index):
                d = group.loc[i, "payment_date"]
                others = np.delete(dates, idx)
                gaps[i] = int(
                    np.min(np.abs((others - np.datetime64(d)) / np.timedelta64(1, "D")))
                )
        min_gap_days.append(pd.Series(gaps))
    df["min_days_to_other_payment_same_vendor"] = pd.concat(min_gap_days).reindex(
        df.index
    )

    fuzzy_scores = vendor_fuzzy_scores(df["vendor_name"])
    df["best_fuzzy_match_score_to_other_vendor"] = df["vendor_name"].map(fuzzy_scores)

    feature_cols = [
        "amount",
        "log_amount",
        "vendor_payment_count",
        "same_vendor_same_amount_count",
        "min_days_to_other_payment_same_vendor",
        "amount_zscore_within_vendor",
        "best_fuzzy_match_score_to_other_vendor",
    ]
    return df, feature_cols


def evaluate(true_labels, predicted_labels):
    cm = confusion_matrix(true_labels, predicted_labels, labels=[0, 1])
    return {
        "precision": round(float(precision_score(true_labels, predicted_labels, zero_division=0)), 4),
        "recall": round(float(recall_score(true_labels, predicted_labels, zero_division=0)), 4),
        "f1": round(float(f1_score(true_labels, predicted_labels, zero_division=0)), 4),
        "confusion_matrix": {
            "true_neg": int(cm[0, 0]),
            "false_pos": int(cm[0, 1]),
            "false_neg": int(cm[1, 0]),
            "true_pos": int(cm[1, 1]),
        },
    }


def isolation_forest_results(X, y):
    model = IsolationForest(
        contamination=ASSUMED_ANOMALY_RATE, random_state=RANDOM_STATE, n_estimators=200
    )
    preds = model.fit_predict(X)
    flagged = (preds == -1).astype(int)
    primary = evaluate(y, flagged)
    primary["contamination_used"] = ASSUMED_ANOMALY_RATE

    # Disclosed sensitivity sweep: best F1 achievable if contamination were
    # tuned against the known labels. Requires label access a real
    # unsupervised deployment wouldn't have at detection time.
    best = {"f1": -1}
    for c in np.arange(0.02, 0.31, 0.01):
        m = IsolationForest(contamination=float(c), random_state=RANDOM_STATE, n_estimators=200)
        p = (m.fit_predict(X) == -1).astype(int)
        f1 = f1_score(y, p, zero_division=0)
        if f1 > best["f1"]:
            best = {"contamination": round(float(c), 2), "f1": round(float(f1), 4)}

    return primary, best, flagged


def dbscan_results(X, y):
    # min_samples=3: with only ~15 payments per vendor on average, a lower
    # min_samples avoids treating every small legitimate vendor as noise.
    min_samples = 3
    k_distances = np.sort(
        np.partition(
            np.linalg.norm(X[:, None, :] - X[None, :, :], axis=-1), min_samples, axis=1
        )[:, min_samples]
    )
    eps = float(np.percentile(k_distances, 100 * (1 - ASSUMED_ANOMALY_RATE)))

    model = DBSCAN(eps=eps, min_samples=min_samples)
    labels = model.fit_predict(X)
    flagged = (labels == -1).astype(int)
    primary = evaluate(y, flagged)
    primary["eps_used"] = round(eps, 3)
    primary["min_samples_used"] = min_samples
    primary["pct_flagged_as_noise"] = round(float(flagged.mean()), 4)

    best = {"f1": -1}
    for pct in np.arange(80, 99, 1):
        e = float(np.percentile(k_distances, pct))
        m = DBSCAN(eps=e, min_samples=min_samples)
        p = (m.fit_predict(X) == -1).astype(int)
        f1 = f1_score(y, p, zero_division=0)
        if f1 > best["f1"]:
            best = {"eps": round(e, 3), "f1": round(float(f1), 4)}

    return primary, best, flagged


def rule_based_reference():
    """Real numbers from a fresh run of the sibling project's rule-based
    checker against this exact same ledger/ground-truth pair — not
    re-derived here, cited directly. Evaluated at the seeded-GROUP level
    (52 groups), not the individual-payment level like the two detectors
    above — a real unit-of-analysis difference, not an apples-to-apples
    number, documented in the README."""
    return {
        "unit_of_analysis": "seeded group (52 groups), not individual payment",
        "recall": 0.981,
        "precision": 1.0,
        "source": "duplicate-vendor-payment-checker/output/flagged.json, "
        "re-run 2026-08-18 against the identical ledger.csv/ground_truth.json "
        "copied into this project's data/",
    }


def make_charts(comparison, df, X_scaled, if_flagged, y):
    fig, ax = plt.subplots(figsize=(7, 5))
    methods = ["Rule-based\n(4 heuristics)", "Isolation Forest", "DBSCAN"]
    precisions = [
        comparison["rule_based"]["precision"],
        comparison["isolation_forest"]["primary"]["precision"],
        comparison["dbscan"]["primary"]["precision"],
    ]
    recalls = [
        comparison["rule_based"]["recall"],
        comparison["isolation_forest"]["primary"]["recall"],
        comparison["dbscan"]["primary"]["recall"],
    ]
    x = np.arange(len(methods))
    width = 0.35
    ax.bar(x - width / 2, precisions, width, label="Precision", color="#4C72B0")
    ax.bar(x + width / 2, recalls, width, label="Recall", color="#DD8452")
    ax.set_xticks(x, methods)
    ax.set_ylim(0, 1.05)
    ax.set_title("Rule-based heuristics vs. unsupervised anomaly detection")
    ax.legend()
    for i, (p, r) in enumerate(zip(precisions, recalls)):
        ax.text(i - width / 2, p + 0.02, f"{p:.0%}", ha="center")
        ax.text(i + width / 2, r + 0.02, f"{r:.0%}", ha="center")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "comparison_chart.png", dpi=150)
    plt.close(fig)

    pca = PCA(n_components=2, random_state=RANDOM_STATE)
    coords = pca.fit_transform(X_scaled)
    fig, ax = plt.subplots(figsize=(7, 6))
    normal = y == 0
    ax.scatter(coords[normal, 0], coords[normal, 1], c="lightgray", s=15, label="Normal (true)")
    true_anom_caught = (y == 1) & (if_flagged == 1)
    true_anom_missed = (y == 1) & (if_flagged == 0)
    false_pos = (y == 0) & (if_flagged == 1)
    ax.scatter(coords[true_anom_caught, 0], coords[true_anom_caught, 1], c="green", s=40, label="True anomaly, caught")
    ax.scatter(coords[true_anom_missed, 0], coords[true_anom_missed, 1], c="red", marker="x", s=50, label="True anomaly, missed")
    ax.scatter(coords[false_pos, 0], coords[false_pos, 1], c="orange", marker="^", s=30, label="False positive")
    ax.set_title("Isolation Forest results in 2D PCA feature space")
    ax.set_xlabel(f"PC1 ({pca.explained_variance_ratio_[0]:.0%} var)")
    ax.set_ylabel(f"PC2 ({pca.explained_variance_ratio_[1]:.0%} var)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "pca_scatter.png", dpi=150)
    plt.close(fig)


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    ledger, ground_truth = load_data()
    df, feature_cols = build_features(ledger)

    X = df[feature_cols].to_numpy(dtype=float)
    y = df["true_anomaly"].to_numpy()
    X_scaled = StandardScaler().fit_transform(X)

    if_primary, if_best, if_flagged = isolation_forest_results(X_scaled, y)
    db_primary, db_best, db_flagged = dbscan_results(X_scaled, y)
    rule_based = rule_based_reference()

    comparison = {
        "rule_based": rule_based,
        "isolation_forest": {"primary": if_primary, "label_tuned_upper_bound": if_best},
        "dbscan": {"primary": db_primary, "label_tuned_upper_bound": db_best},
    }

    results = {
        "dataset": {
            "source": "duplicate-vendor-payment-checker/data/{ledger.csv,ground_truth.json} "
            "(same repo, synthetic, seeded ground truth) — copied here unchanged",
            "n_payments": int(len(df)),
            "n_true_anomalous_payments": int(y.sum()),
            "true_anomaly_rate": round(float(y.mean()), 4),
            "assumed_anomaly_rate_used_for_primary_runs": ASSUMED_ANOMALY_RATE,
        },
        "features": feature_cols,
        "comparison": comparison,
    }
    (OUTPUT_DIR / "results.json").write_text(json.dumps(results, indent=2))
    make_charts(comparison, df, X_scaled, if_flagged, y)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
