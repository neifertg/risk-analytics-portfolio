"""Runs the sampling-calculator's own correctness verification, then two
full worked examples (attribute sampling and monetary-unit/PPS sampling)
against the illustrative synthetic populations from generate_populations.py.

Usage:
    .venv/Scripts/python.exe check.py
"""

import json
import random
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

from sampling import (
    reliability_factor, plan_attribute_sample, evaluate_attribute_sample,
    plan_mus_sample, select_pps_sample, evaluate_mus_sample,
)

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_DIR = Path(__file__).parent / "output"
SEED = 20240922

# 10 real published AICPA/PPS reliability-factor table values, used to
# verify reliability_factor() before it's used for anything else. Sourced
# and cross-corroborated during research -- see README.md "Methodology and
# sources."
REFERENCE_ROW0_BY_RISK = {0.01: 4.61, 0.05: 3.00, 0.10: 2.31, 0.15: 1.90, 0.20: 1.61}
REFERENCE_K_AT_95 = {0: 3.00, 1: 4.75, 2: 6.30, 3: 7.76, 4: 9.16}
MAX_ALLOWED_DIFF = 0.02  # published table is itself rounded to 2 decimals


def verify_reliability_factors() -> dict:
    checks = []
    for risk, published in REFERENCE_ROW0_BY_RISK.items():
        computed = reliability_factor(0, 1 - risk)
        checks.append({"case": f"k=0, risk={risk:.0%}", "published": published,
                        "computed": round(computed, 3), "diff": round(abs(computed - published), 4)})
    for k, published in REFERENCE_K_AT_95.items():
        computed = reliability_factor(k, 0.95)
        checks.append({"case": f"k={k}, confidence=95%", "published": published,
                        "computed": round(computed, 3), "diff": round(abs(computed - published), 4)})

    max_diff = max(c["diff"] for c in checks)
    all_pass = max_diff <= MAX_ALLOWED_DIFF
    for c in checks:
        assert c["diff"] <= MAX_ALLOWED_DIFF, f"Reliability factor mismatch: {c}"
    return {"checks": checks, "max_diff": round(max_diff, 4), "all_pass": all_pass}


def run_attribute_sampling_example() -> dict:
    df = pd.read_csv(DATA_DIR / "po_population.csv")
    plan = plan_attribute_sample(population_size=len(df), confidence_level=0.95,
                                  tolerable_rate=0.05, expected_rate=0.02)

    rng = random.Random(SEED)
    sample_idx = rng.sample(range(len(df)), plan.sample_size)
    sample = df.iloc[sample_idx]
    deviations_found = int((~sample["approved"]).sum())

    result = evaluate_attribute_sample(plan.sample_size, deviations_found,
                                        plan.confidence_level, plan.tolerable_rate)
    return {
        "scenario": "Attribute sampling: were purchase orders properly approved?",
        "plan": {"population_size": plan.population_size, "confidence_level": plan.confidence_level,
                 "tolerable_rate": plan.tolerable_rate, "expected_rate": plan.expected_rate,
                 "sample_size": plan.sample_size},
        "actual_sample_deviations_found": deviations_found,
        "computed_upper_deviation_rate": round(result.computed_upper_deviation_rate, 4),
        "conclusion": result.conclusion,
    }


def run_mus_example() -> dict:
    df = pd.read_csv(DATA_DIR / "ar_population.csv")
    population_value = float(df["book_value"].sum())
    tolerable_misstatement = round(population_value * 0.025, -3)

    plan = plan_mus_sample(population_value=population_value, confidence_level=0.90,
                            tolerable_misstatement=tolerable_misstatement, expected_misstatement=0.0)

    rng = random.Random(SEED)
    start_offset = rng.uniform(0, plan.sampling_interval)
    items = df.to_dict("records")
    selected = select_pps_sample(items, plan.sampling_interval, start_offset)
    selected_misstated = [s for s in selected if s["audited_value"] != s["book_value"]]

    result = evaluate_mus_sample(plan.sampling_interval, plan.confidence_level,
                                  plan.tolerable_misstatement, selected)

    return {
        "scenario": "Monetary-unit (PPS) sampling: is the AR balance fairly stated?",
        "plan": {"population_value": round(population_value, 2), "confidence_level": plan.confidence_level,
                 "tolerable_misstatement": plan.tolerable_misstatement,
                 "expected_misstatement": plan.expected_misstatement,
                 "sample_size": plan.sample_size, "sampling_interval": round(plan.sampling_interval, 2),
                 "approximated_expansion": plan.approximated_expansion},
        "items_selected": len(selected),
        "seeded_misstatements_selected": len(selected_misstated),
        "selected_misstatement_detail": [
            {"account_id": s["account_id"], "book_value": s["book_value"], "audited_value": s["audited_value"]}
            for s in selected_misstated
        ],
        "basic_precision": round(result.basic_precision, 2),
        "projected_misstatement": round(result.projected_misstatement, 2),
        "incremental_allowance": round(result.incremental_allowance, 2),
        "upper_misstatement_limit": round(result.upper_misstatement_limit, 2),
        "conclusion": result.conclusion,
    }


def make_chart(out_path: Path) -> None:
    ks = list(range(0, 9))
    fig, ax = plt.subplots(figsize=(8, 5.5))
    for conf, color in [(0.90, "#2E5EAA"), (0.95, "#C9622E"), (0.99, "#3E8C5B")]:
        ys = [reliability_factor(k, conf) for k in ks]
        ax.plot(ks, ys, marker="o", label=f"{conf:.0%} confidence", color=color)

    ref_ks = list(REFERENCE_K_AT_95.keys())
    ref_vals = list(REFERENCE_K_AT_95.values())
    ax.scatter(ref_ks, ref_vals, s=90, facecolors="none", edgecolors="black", linewidths=1.5,
               zorder=5, label="Published AICPA/PPS reference values")

    ax.set_xlabel("Number of errors/misstatements (k)")
    ax.set_ylabel("Reliability factor")
    ax.set_title("Reliability factor vs. errors found\n(computed via chi-square relationship, verified against published values)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def main() -> None:
    verification = verify_reliability_factors()
    print("--- Reliability factor verification ---")
    for c in verification["checks"]:
        status = "OK" if c["diff"] <= MAX_ALLOWED_DIFF else "MISMATCH"
        print(f"  [{status}] {c['case']}: published={c['published']} computed={c['computed']} diff={c['diff']}")
    print(f"Max diff: {verification['max_diff']} (all published to 2 decimals) -> "
          f"{'PASS' if verification['all_pass'] else 'FAIL'}")

    attribute_result = run_attribute_sampling_example()
    print("\n--- Attribute sampling example ---")
    print(json.dumps(attribute_result, indent=2))

    mus_result = run_mus_example()
    print("\n--- MUS/PPS sampling example ---")
    print(json.dumps(mus_result, indent=2))

    OUTPUT_DIR.mkdir(exist_ok=True)
    report = {
        "reliability_factor_verification": verification,
        "attribute_sampling_example": attribute_result,
        "mus_sampling_example": mus_result,
    }
    (OUTPUT_DIR / "report.json").write_text(json.dumps(report, indent=2, default=str))
    print(f"\nWrote {OUTPUT_DIR / 'report.json'}")

    make_chart(OUTPUT_DIR / "chart.png")
    print(f"Wrote {OUTPUT_DIR / 'chart.png'}")


if __name__ == "__main__":
    main()
