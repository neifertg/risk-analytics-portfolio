"""Benford's Law analysis of real, public financial-statement data.

Pulls every company's reported Total Assets for one fiscal period from
SEC EDGAR's XBRL Frames API (free, no API key), checks the leading-digit
distribution against Benford's Law using both a chi-square goodness-of-fit
test and Nigrini's MAD (Mean Absolute Deviation) conformity score — MAD is
the more standard metric in forensic-accounting practice, since chi-square
grows with sample size and can flag trivial deviations as "significant"
on datasets this large.

Usage:
    .venv/Scripts/python.exe analyze.py
"""

import json
import math
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import requests
from scipy import stats

TAXONOMY = "us-gaap"
CONCEPT = "Assets"
UNIT = "USD"
PERIOD = "CY2023Q4I"  # instantaneous (balance-sheet-date) frame, Q4 2023
FRAMES_URL = f"https://data.sec.gov/api/xbrl/frames/{TAXONOMY}/{CONCEPT}/{UNIT}/{PERIOD}.json"

# SEC requires a descriptive User-Agent identifying the requester —
# https://www.sec.gov/os/webmaster-faq#developers
HEADERS = {"User-Agent": "G. Seth Neifert Personal Portfolio Project gsneifert@gmail.com"}

OUTPUT_DIR = Path(__file__).parent / "output"


def fetch_values() -> pd.DataFrame:
    resp = requests.get(FRAMES_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    payload = resp.json()
    df = pd.DataFrame(payload["data"])
    return df


def leading_digit(value: float) -> int:
    value = abs(value)
    while value < 1:
        value *= 10
    while value >= 10:
        value /= 10
    return int(value)


def benford_expected() -> dict[int, float]:
    return {d: math.log10(1 + 1 / d) for d in range(1, 10)}


def analyze(df: pd.DataFrame) -> dict:
    # Benford's Law applies to naturally-occurring positive magnitudes with
    # no artificial minimum/maximum — drop non-positive values (a handful
    # of filers report negative or zero total assets, e.g. shell companies
    # or restatements) since they have no defined leading digit under the
    # law's own assumptions.
    values = df.loc[df["val"] > 0, "val"]
    digits = values.apply(leading_digit)

    observed_counts = digits.value_counts().reindex(range(1, 10), fill_value=0).sort_index()
    n = observed_counts.sum()
    observed_freq = observed_counts / n

    expected_freq = pd.Series(benford_expected())
    expected_counts = expected_freq * n

    chi2_stat, chi2_p = stats.chisquare(f_obs=observed_counts, f_exp=expected_counts)

    mad = (observed_freq - expected_freq).abs().mean()
    # Nigrini's first-digit MAD conformity thresholds (Nigrini, 2012,
    # "Benford's Law: Applications for Forensic Accounting, Auditing, and
    # Fraud Detection").
    if mad < 0.006:
        conformity = "Close conformity"
    elif mad < 0.012:
        conformity = "Acceptable conformity"
    elif mad < 0.015:
        conformity = "Marginally acceptable conformity"
    else:
        conformity = "Nonconformity"

    return {
        "concept": f"{TAXONOMY}:{CONCEPT}",
        "period": PERIOD,
        "n_filers_total": int(len(df)),
        "n_positive_values_analyzed": int(n),
        "n_excluded_non_positive": int(len(df) - n),
        "observed_frequency": {str(d): round(float(observed_freq[d]), 5) for d in range(1, 10)},
        "expected_frequency": {str(d): round(float(expected_freq[d]), 5) for d in range(1, 10)},
        "chi_square_statistic": round(float(chi2_stat), 3),
        "chi_square_p_value": round(float(chi2_p), 6),
        "mad": round(float(mad), 5),
        "nigrini_conformity": conformity,
    }


def make_chart(results: dict, out_path: Path) -> None:
    digits = list(range(1, 10))
    observed = [results["observed_frequency"][str(d)] for d in digits]
    expected = [results["expected_frequency"][str(d)] for d in digits]

    x = np.arange(len(digits))
    width = 0.38

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar(x - width / 2, observed, width, label="Observed", color="#2E5EAA")
    ax.bar(x + width / 2, expected, width, label="Benford's expected", color="#C4632B")
    ax.set_xticks(x)
    ax.set_xticklabels(digits)
    ax.set_xlabel("Leading digit")
    ax.set_ylabel("Frequency")
    ax.set_title(
        f"Leading-digit distribution vs. Benford's Law\n"
        f"{results['concept']} — {results['period']} — n={results['n_positive_values_analyzed']:,}"
    )
    ax.legend()
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def main() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)

    print(f"Fetching {CONCEPT} ({UNIT}) for {PERIOD} from SEC EDGAR...")
    df = fetch_values()
    print(f"  {len(df)} filers returned.")

    results = analyze(df)

    results_path = OUTPUT_DIR / "results.json"
    results_path.write_text(json.dumps(results, indent=2))
    print(f"Wrote {results_path}")

    chart_path = OUTPUT_DIR / "chart.png"
    make_chart(results, chart_path)
    print(f"Wrote {chart_path}")

    print("\n--- Findings ---")
    print(f"Analyzed {results['n_positive_values_analyzed']:,} positive values "
          f"({results['n_excluded_non_positive']} non-positive excluded).")
    print(f"Chi-square: statistic={results['chi_square_statistic']}, p={results['chi_square_p_value']}")
    print(f"MAD: {results['mad']} -> {results['nigrini_conformity']}")


if __name__ == "__main__":
    main()
