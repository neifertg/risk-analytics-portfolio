"""Flags users holding both sides of a defined segregation-of-duties (SoD)
conflict pair, based on their CURRENT active access -- not raw grant
history -- across a synthetic access-rights population.

data/conflict_matrix.json is real audit-test configuration (the criteria
being tested), not a secret; it's loaded and used directly. It's distinct
from data/ground_truth.json, which records which specific users were
seeded with which conflict scenario during generation and is only used
below to score real precision/recall -- the detection logic itself never
reads it.

Usage:
    .venv/Scripts/python.exe check.py
"""

import json
from datetime import date
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_DIR = Path(__file__).parent / "output"
ANALYSIS_DATE = date(2024, 12, 31)


def load_active_grants() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / "access_grants.csv", parse_dates=["granted_date", "revoked_date"])
    active = df[df["revoked_date"].isna() | (df["revoked_date"].dt.date > ANALYSIS_DATE)]
    return active


def find_conflicts(active: pd.DataFrame, conflict_matrix: list[dict]) -> list[dict]:
    by_user: dict[str, dict[str, dict]] = {}
    for _, row in active.iterrows():
        by_user.setdefault(row["user_id"], {})[row["access_right"]] = {
            "source": row["source"], "granted_date": row["granted_date"].date().isoformat(),
        }

    flags = []
    for user_id, rights in by_user.items():
        for pair in conflict_matrix:
            a, b = pair["right_a"], pair["right_b"]
            if a in rights and b in rights:
                flags.append({
                    "user_id": user_id,
                    "process": pair["process"],
                    "right_a": a, "right_a_source": rights[a]["source"],
                    "right_b": b, "right_b_source": rights[b]["source"],
                    "risk": pair["risk"],
                    "detail": (f"{user_id} holds both '{a}' (via {rights[a]['source']}) and "
                               f"'{b}' (via {rights[b]['source']}) -- {pair['risk']}"),
                })
    return flags


def score(flags: list[dict], ground_truth: list[dict]) -> dict:
    flagged_users = {f["user_id"] for f in flags}

    should_flag = [g for g in ground_truth if g["type"] in ("exception_grant_conflict", "role_design_conflict")]
    should_not_flag = [g for g in ground_truth if g["type"] == "remediated_conflict"]

    per_type: dict[str, dict] = {}
    for g in should_flag:
        t = g["type"]
        per_type.setdefault(t, {"seeded": 0, "caught": 0})
        per_type[t]["seeded"] += 1
        if g["user_id"] in flagged_users:
            per_type[t]["caught"] += 1
    caught_total = sum(v["caught"] for v in per_type.values())

    remediated_correctly_unflagged = sum(1 for g in should_not_flag if g["user_id"] not in flagged_users)
    remediated_false_positives = [g["user_id"] for g in should_not_flag if g["user_id"] in flagged_users]

    seeded_conflict_users = {g["user_id"] for g in should_flag}
    unexplained_flags = [f for f in flags if f["user_id"] not in seeded_conflict_users]

    total_should_flag = len(should_flag)
    return {
        "seeded_conflict_users_total": total_should_flag,
        "seeded_conflict_users_caught": caught_total,
        "recall": round(caught_total / total_should_flag, 3) if total_should_flag else None,
        "per_type": {
            t: {"seeded": v["seeded"], "caught": v["caught"], "recall": round(v["caught"] / v["seeded"], 3)}
            for t, v in per_type.items()
        },
        "remediated_users_total": len(should_not_flag),
        "remediated_correctly_unflagged": remediated_correctly_unflagged,
        "remediated_false_positives": remediated_false_positives,
        "remediation_specificity": (round(remediated_correctly_unflagged / len(should_not_flag), 3)
                                     if should_not_flag else None),
        "total_flags_raised": len(flags),
        "unexplained_flags": unexplained_flags,
        "precision": (round((len(flags) - len(unexplained_flags)) / len(flags), 3) if flags else None),
    }


def make_chart(flags: list[dict], out_path: Path, users_scanned: int) -> None:
    counts: dict[str, int] = {}
    for f in flags:
        counts[f["process"]] = counts.get(f["process"], 0) + 1
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar(list(counts.keys()), list(counts.values()), color="#2E5EAA")
    ax.set_ylabel("Users flagged with an active conflict")
    ax.set_title(f"SoD conflicts by process\n(n={users_scanned:,} users scanned)")
    plt.setp(ax.get_xticklabels(), rotation=15, ha="right")
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def main() -> None:
    active = load_active_grants()
    conflict_matrix = json.loads((DATA_DIR / "conflict_matrix.json").read_text())
    ground_truth = json.loads((DATA_DIR / "ground_truth.json").read_text())

    flags = find_conflicts(active, conflict_matrix)
    scoring = score(flags, ground_truth)
    users_scanned = active["user_id"].nunique()

    results = {
        "users_scanned": int(users_scanned),
        "active_grants_scanned": int(len(active)),
        "users_flagged": len({f["user_id"] for f in flags}),
        "total_flags": len(flags),
        "scoring_against_seeded_ground_truth": scoring,
        "flags": flags,
    }

    OUTPUT_DIR.mkdir(exist_ok=True)
    (OUTPUT_DIR / "flagged.json").write_text(json.dumps(results, indent=2, default=str))
    print(f"Wrote {OUTPUT_DIR / 'flagged.json'}")

    make_chart(flags, OUTPUT_DIR / "chart.png", users_scanned)
    print(f"Wrote {OUTPUT_DIR / 'chart.png'}")

    print("\n--- Findings ---")
    print(f"Scanned {users_scanned:,} users, {len(active):,} active access grants.")
    print(f"Users flagged with an active SoD conflict: {results['users_flagged']}")
    print(f"Recall vs. {scoring['seeded_conflict_users_total']} seeded active-conflict users: "
          f"{scoring['seeded_conflict_users_caught']}/{scoring['seeded_conflict_users_total']} "
          f"({scoring['recall']:.0%})")
    print("Per-type recall:")
    for t, v in scoring["per_type"].items():
        print(f"  {t}: {v['caught']}/{v['seeded']} ({v['recall']:.0%})")
    print(f"Precision: {results['total_flags'] - len(scoring['unexplained_flags'])}/{results['total_flags']} "
          f"flags trace to a seeded case ({scoring['precision']:.0%}).")
    print(f"Remediation specificity: {scoring['remediated_correctly_unflagged']}/"
          f"{scoring['remediated_users_total']} previously-revoked users correctly left "
          f"unflagged ({scoring['remediation_specificity']:.0%}).")


if __name__ == "__main__":
    main()
