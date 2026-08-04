"""Detects potential duplicate/split vendor payments in a synthetic
accounts-payable ledger using four concrete, named internal-audit
AP-recon heuristics — not one opaque similarity score.

Also scores the results against data/ground_truth.json (the seeded cases
from generate_ledger.py) to report real precision/recall. That scoring
step is only possible because this is labeled synthetic data — the
detection heuristics above never read ground_truth.json.

Usage:
    .venv/Scripts/python.exe check.py
"""

import json
from itertools import combinations
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from rapidfuzz import fuzz

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_DIR = Path(__file__).parent / "output"

APPROVAL_THRESHOLD = 10_000.0
THRESHOLD_MARGIN = 0.12        # "just under" = within 12% below threshold
SPLIT_WINDOW_DAYS = 14
NEAR_DUP_WINDOW_DAYS = 30
FUZZY_VENDOR_THRESHOLD = 90


def load_ledger() -> pd.DataFrame:
    return pd.read_csv(DATA_DIR / "ledger.csv", parse_dates=["payment_date"])


def find_exact_duplicates(df: pd.DataFrame) -> list[dict]:
    """Same vendor, same invoice number, same amount, paid more than once."""
    flags = []
    for (vendor, invoice, amount), group in df.groupby(["vendor_name", "invoice_number", "amount"]):
        if len(group) > 1:
            flags.append({
                "flag_type": "exact_duplicate",
                "confidence": "duplicate",
                "vendor_name": vendor,
                "payment_ids": group["payment_id"].tolist(),
                "detail": f"Same vendor, invoice {invoice}, amount {amount} paid {len(group)} times.",
            })
    return flags


def find_threshold_splits(df: pd.DataFrame) -> list[dict]:
    """Same vendor, two-plus payments each just under the approval
    threshold, close together in time — classic structuring/threshold-
    avoidance pattern."""
    flags = []
    lower = APPROVAL_THRESHOLD * (1 - THRESHOLD_MARGIN)
    near_threshold = df[(df["amount"] >= lower) & (df["amount"] < APPROVAL_THRESHOLD)]
    for vendor, group in near_threshold.groupby("vendor_name"):
        rows = group.sort_values("payment_date").to_dict("records")
        used = set()
        for i in range(len(rows)):
            if rows[i]["payment_id"] in used:
                continue
            cluster = [rows[i]]
            for j in range(i + 1, len(rows)):
                gap = (rows[j]["payment_date"] - rows[i]["payment_date"]).days
                if gap <= SPLIT_WINDOW_DAYS:
                    cluster.append(rows[j])
            if len(cluster) > 1:
                ids = [r["payment_id"] for r in cluster]
                used.update(ids)
                total = sum(r["amount"] for r in cluster)
                flags.append({
                    "flag_type": "threshold_split",
                    "confidence": "duplicate",
                    "vendor_name": vendor,
                    "payment_ids": ids,
                    "detail": (f"{len(cluster)} payments each within "
                               f"{THRESHOLD_MARGIN:.0%} below the "
                               f"${APPROVAL_THRESHOLD:,.0f} approval threshold, "
                               f"within {SPLIT_WINDOW_DAYS} days (combined "
                               f"${total:,.2f})."),
                })
    return flags


def find_vendor_master_duplicates(df: pd.DataFrame) -> list[dict]:
    """Same invoice number and amount paid under two different-but-similar
    vendor names — a likely duplicate vendor-master record, not a
    duplicate invoice."""
    flags = []
    for (invoice, amount), group in df.groupby(["invoice_number", "amount"]):
        vendors = group["vendor_name"].unique()
        if len(vendors) < 2:
            continue
        for v1, v2 in combinations(vendors, 2):
            ratio = fuzz.token_sort_ratio(v1, v2)
            if ratio >= FUZZY_VENDOR_THRESHOLD:
                ids = group[group["vendor_name"].isin([v1, v2])]["payment_id"].tolist()
                flags.append({
                    "flag_type": "vendor_master_duplicate",
                    "confidence": "duplicate",
                    "vendor_name": f"{v1} / {v2}",
                    "payment_ids": ids,
                    "detail": (f"Invoice {invoice}, amount {amount} paid under two "
                               f"vendor names ({ratio:.0f}% name similarity) — "
                               f"likely duplicate vendor-master record."),
                })
    return flags


def find_review_candidates(df: pd.DataFrame) -> list[dict]:
    """Same vendor, same amount, different invoice number, within the
    review window — plausible but not certain; a lower-confidence flag
    for manual review rather than a confirmed duplicate."""
    flags = []
    for vendor, group in df.groupby("vendor_name"):
        rows = group.sort_values("payment_date").to_dict("records")
        for a, b in combinations(rows, 2):
            if a["invoice_number"] == b["invoice_number"]:
                continue  # already an exact-duplicate case
            if a["amount"] != b["amount"]:
                continue
            gap = abs((b["payment_date"] - a["payment_date"]).days)
            if 0 < gap <= NEAR_DUP_WINDOW_DAYS:
                flags.append({
                    "flag_type": "review_candidate",
                    "confidence": "review_candidate",
                    "vendor_name": vendor,
                    "payment_ids": [a["payment_id"], b["payment_id"]],
                    "detail": (f"Same vendor and amount ({a['amount']}), different "
                               f"invoice numbers, {gap} days apart — worth a manual "
                               f"look, not a confirmed duplicate."),
                })
    return flags


def score_against_ground_truth(all_flags: list[dict], ground_truth: list[dict]) -> dict:
    by_confidence = {"duplicate": [], "review_candidate": []}
    for f in all_flags:
        by_confidence[f["confidence"]].append(set(f["payment_ids"]))

    per_type: dict[str, dict] = {}
    caught_total = 0
    for gt in ground_truth:
        ids = set(gt["payment_ids"])
        candidates = by_confidence[gt["confidence"]]
        caught = any(ids.issubset(flag_ids) for flag_ids in candidates)
        if not caught:
            # A seeded group may surface as multiple pairwise flags rather
            # than one N-way cluster; also count it caught if every seeded
            # id is covered across flags of the right confidence tier.
            covered: set = set()
            for flag_ids in candidates:
                covered |= (flag_ids & ids)
            caught = covered == ids
        t = gt["type"]
        per_type.setdefault(t, {"seeded": 0, "caught": 0})
        per_type[t]["seeded"] += 1
        if caught:
            per_type[t]["caught"] += 1
            caught_total += 1

    seeded_ids: set = set()
    for gt in ground_truth:
        seeded_ids.update(gt["payment_ids"])
    false_positive_flags = [f for f in all_flags if not (set(f["payment_ids"]) & seeded_ids)]

    total_groups = len(ground_truth)
    return {
        "seed_groups_total": total_groups,
        "seed_groups_caught": caught_total,
        "recall": round(caught_total / total_groups, 3) if total_groups else None,
        "per_type": {
            t: {"seeded": v["seeded"], "caught": v["caught"], "recall": round(v["caught"] / v["seeded"], 3)}
            for t, v in per_type.items()
        },
        "total_flags_raised": len(all_flags),
        "false_positive_flag_count": len(false_positive_flags),
        "false_positive_flags": false_positive_flags,
        "precision": (round((len(all_flags) - len(false_positive_flags)) / len(all_flags), 3)
                      if all_flags else None),
    }


def make_chart(results: dict, out_path: Path) -> None:
    types = list(results["flags_by_type"].keys())
    counts = [results["flags_by_type"][t] for t in types]
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar(types, counts, color="#2E5EAA")
    ax.set_ylabel("Flags raised")
    ax.set_title(
        f"Duplicate-payment flags by type\n(n={results['records_scanned']:,} payments scanned)"
    )
    plt.setp(ax.get_xticklabels(), rotation=20, ha="right")
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def main() -> None:
    df = load_ledger()

    exact = find_exact_duplicates(df)
    splits = find_threshold_splits(df)
    vendor_dups = find_vendor_master_duplicates(df)
    review = find_review_candidates(df)
    all_flags = exact + splits + vendor_dups + review

    ground_truth = json.loads((DATA_DIR / "ground_truth.json").read_text())
    scoring = score_against_ground_truth(all_flags, ground_truth)

    results = {
        "records_scanned": int(len(df)),
        "flags_by_type": {
            "exact_duplicate": len(exact),
            "threshold_split": len(splits),
            "vendor_master_duplicate": len(vendor_dups),
            "review_candidate": len(review),
        },
        "total_flags": len(all_flags),
        "scoring_against_seeded_ground_truth": scoring,
        "flags": all_flags,
    }

    OUTPUT_DIR.mkdir(exist_ok=True)
    (OUTPUT_DIR / "flagged.json").write_text(json.dumps(results, indent=2, default=str))
    print(f"Wrote {OUTPUT_DIR / 'flagged.json'}")

    make_chart(results, OUTPUT_DIR / "chart.png")
    print(f"Wrote {OUTPUT_DIR / 'chart.png'}")

    print("\n--- Findings ---")
    print(f"Scanned {results['records_scanned']:,} payment records.")
    print(f"Flags by type: {results['flags_by_type']}")
    print(f"Recall vs. {scoring['seed_groups_total']} seeded groups: "
          f"{scoring['seed_groups_caught']}/{scoring['seed_groups_total']} "
          f"({scoring['recall']:.0%})")
    print(f"Precision: {scoring['false_positive_flag_count']} false-positive flags "
          f"out of {scoring['total_flags_raised']} total "
          f"({scoring['precision']:.0%} precision).")


if __name__ == "__main__":
    main()
