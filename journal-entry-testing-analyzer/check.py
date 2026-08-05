"""Flags potential fraud-risk journal entries in a synthetic general-ledger
population using five concrete, named risk criteria -- lifted directly from
Seth_Wiki's journal-entry-testing.md resource note (itself sourced from
AU-C 240 / PCAOB AS 2401), not invented for this project.

Also scores the results against data/ground_truth.json (the seeded entries
from generate_journal_entries.py) to report real precision/recall. That
scoring step is only possible because this is labeled synthetic data --
the detection heuristics below never read ground_truth.json.

Usage:
    .venv/Scripts/python.exe check.py
"""

import json
from datetime import date, timedelta
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_DIR = Path(__file__).parent / "output"

HOLIDAYS_2024 = {
    date(2024, 1, 1), date(2024, 1, 15), date(2024, 2, 19),
    date(2024, 5, 27), date(2024, 6, 19), date(2024, 7, 4),
    date(2024, 9, 2), date(2024, 10, 14), date(2024, 11, 11),
    date(2024, 11, 28), date(2024, 12, 25),
}
GENERIC_DESCRIPTIONS = {
    "", "adjustment", "reclass", "reclassification", "tbd", "n/a", "na",
    "misc", "correction", "see attached",
}
RARE_PREPARER_MAX_COUNT = 10   # a preparer posting this few entries all year is itself unusual
RARE_PAIR_MAX_COUNT = 6        # an account combination this rarely used is itself unusual
ROUND_AMOUNT_MODULUS = 500


def load_entries() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / "journal_entries.csv", parse_dates=["entry_date"])
    df["entry_date"] = df["entry_date"].dt.date
    return df


def find_unusual_preparers(df: pd.DataFrame) -> list[dict]:
    """Entries posted by someone who posts unusually few journal entries
    overall -- "users who don't normally post journal entries, or senior
    personnel who could override normal review" (journal-entry-testing.md)."""
    counts = df["prepared_by"].value_counts()
    rare = counts[counts <= RARE_PREPARER_MAX_COUNT]
    flags = []
    for preparer in rare.index:
        for _, row in df[df["prepared_by"] == preparer].iterrows():
            flags.append({
                "flag_type": "unusual_preparer",
                "confidence": "review_candidate",
                "entry_id": row["entry_id"],
                "detail": (f"Prepared by '{preparer}', who posted only "
                           f"{counts[preparer]} entr{'y' if counts[preparer] == 1 else 'ies'} "
                           f"all year (population-wide rarity, not a blocklist)."),
            })
    return flags


def find_weekend_or_holiday_postings(df: pd.DataFrame) -> list[dict]:
    """Entries dated on a weekend or a recognized holiday."""
    flags = []
    for _, row in df.iterrows():
        d = row["entry_date"]
        if d.weekday() >= 5 or d in HOLIDAYS_2024:
            reason = "weekend" if d.weekday() >= 5 else "holiday"
            flags.append({
                "flag_type": "weekend_or_holiday_posting",
                "confidence": "flag",
                "entry_id": row["entry_id"],
                "detail": f"Posted on a {reason} ({d.isoformat()}).",
            })
    return flags


def find_period_end_cutoff(df: pd.DataFrame) -> list[dict]:
    """Entries posted in the last 2 calendar days of their month --
    period-close cutoff risk."""
    flags = []
    for _, row in df.iterrows():
        d = row["entry_date"]
        if d.month == 12:
            month_end = date(2024, 12, 31)
        else:
            month_end = date(2024, d.month + 1, 1) - timedelta(days=1)
        if (month_end - d).days <= 2:
            flags.append({
                "flag_type": "period_end_cutoff",
                "confidence": "flag",
                "entry_id": row["entry_id"],
                "detail": f"Posted {d.isoformat()}, within 2 days of month-end ({month_end.isoformat()}).",
            })
    return flags


def find_round_dollar_weak_description(df: pd.DataFrame) -> list[dict]:
    """Round-dollar amount AND a generic/missing description -- either
    alone is common in legitimate entries; both together is the red flag."""
    flags = []
    for _, row in df.iterrows():
        amount = row["amount"]
        # An empty-string description round-trips through CSV as NaN, not
        # "" -- str(nan).lower() is the literal text "nan", which silently
        # isn't in GENERIC_DESCRIPTIONS. Caught live: 3 seeded entries with
        # blank descriptions weren't being flagged because of this.
        desc = "" if pd.isna(row["description"]) else str(row["description"]).strip().lower()
        if amount % ROUND_AMOUNT_MODULUS == 0 and desc in GENERIC_DESCRIPTIONS:
            flags.append({
                "flag_type": "round_dollar_weak_description",
                "confidence": "flag",
                "entry_id": row["entry_id"],
                "detail": (f"${amount:,.0f} (multiple of ${ROUND_AMOUNT_MODULUS}) with "
                           f"description '{row['description']}'."),
            })
    return flags


def find_unusual_account_combinations(df: pd.DataFrame) -> list[dict]:
    """Entries hitting a debit/credit account pair that's statistically
    rare across the whole population -- includes top-side/manual entries
    with no operational source system behind them."""
    pair_counts = df.groupby(["debit_account", "credit_account"]).size()
    flags = []
    for _, row in df.iterrows():
        pair = (row["debit_account"], row["credit_account"])
        count = pair_counts[pair]
        if count <= RARE_PAIR_MAX_COUNT:
            flags.append({
                "flag_type": "unusual_account_combination",
                "confidence": "review_candidate",
                "entry_id": row["entry_id"],
                "detail": (f"Dr {pair[0]} / Cr {pair[1]} -- this combination appears "
                           f"only {count} time{'s' if count != 1 else ''} in the whole ledger "
                           f"(source system: {row['source_system']})."),
            })
    return flags


def score_against_ground_truth(all_flags: list[dict], ground_truth: list[dict]) -> dict:
    flagged_by_type: dict[str, set] = {}
    for f in all_flags:
        flagged_by_type.setdefault(f["flag_type"], set()).add(f["entry_id"])
    all_flagged_ids = {f["entry_id"] for f in all_flags}

    per_type: dict[str, dict] = {}
    caught_total = 0
    for gt in ground_truth:
        t = gt["type"]
        caught = gt["entry_id"] in flagged_by_type.get(t, set())
        per_type.setdefault(t, {"seeded": 0, "caught": 0})
        per_type[t]["seeded"] += 1
        if caught:
            per_type[t]["caught"] += 1
            caught_total += 1

    seeded_ids = {gt["entry_id"] for gt in ground_truth}
    false_positive_flags = [f for f in all_flags if f["entry_id"] not in seeded_ids]

    total_groups = len(ground_truth)
    return {
        "seeded_total": total_groups,
        "seeded_caught": caught_total,
        "recall": round(caught_total / total_groups, 3) if total_groups else None,
        "per_type": {
            t: {"seeded": v["seeded"], "caught": v["caught"], "recall": round(v["caught"] / v["seeded"], 3)}
            for t, v in per_type.items()
        },
        "total_flags_raised": len(all_flags),
        "distinct_entries_flagged": len(all_flagged_ids),
        "false_positive_flag_count": len(false_positive_flags),
        "false_positive_flags": false_positive_flags,
        "precision": (round((len(all_flags) - len(false_positive_flags)) / len(all_flags), 3)
                      if all_flags else None),
    }


def make_chart(results: dict, out_path: Path) -> None:
    types = list(results["flags_by_type"].keys())
    counts = [results["flags_by_type"][t] for t in types]
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.bar(types, counts, color="#2E5EAA")
    ax.set_ylabel("Flags raised")
    ax.set_title(
        f"Journal-entry red flags by type\n(n={results['records_scanned']:,} entries scanned)"
    )
    plt.setp(ax.get_xticklabels(), rotation=20, ha="right")
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def main() -> None:
    df = load_entries()

    unusual_preparer = find_unusual_preparers(df)
    weekend_holiday = find_weekend_or_holiday_postings(df)
    period_end = find_period_end_cutoff(df)
    round_dollar = find_round_dollar_weak_description(df)
    unusual_combo = find_unusual_account_combinations(df)
    all_flags = unusual_preparer + weekend_holiday + period_end + round_dollar + unusual_combo

    ground_truth = json.loads((DATA_DIR / "ground_truth.json").read_text())
    scoring = score_against_ground_truth(all_flags, ground_truth)

    results = {
        "records_scanned": int(len(df)),
        "flags_by_type": {
            "unusual_preparer": len(unusual_preparer),
            "weekend_or_holiday_posting": len(weekend_holiday),
            "period_end_cutoff": len(period_end),
            "round_dollar_weak_description": len(round_dollar),
            "unusual_account_combination": len(unusual_combo),
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
    print(f"Scanned {results['records_scanned']:,} journal entries.")
    print(f"Flags by type: {results['flags_by_type']}")
    print(f"Recall vs. {scoring['seeded_total']} seeded entries: "
          f"{scoring['seeded_caught']}/{scoring['seeded_total']} "
          f"({scoring['recall']:.0%})")
    print(f"Precision: {scoring['false_positive_flag_count']} false-positive flags "
          f"out of {scoring['total_flags_raised']} total "
          f"({scoring['precision']:.0%} precision).")
    print("\nPer-type recall:")
    for t, v in scoring["per_type"].items():
        print(f"  {t}: {v['caught']}/{v['seeded']} ({v['recall']:.0%})")


if __name__ == "__main__":
    main()
