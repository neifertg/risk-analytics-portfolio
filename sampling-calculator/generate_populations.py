"""Generates two small illustrative synthetic populations for the sampling
worked examples in check.py:

  - data/po_population.csv: purchase orders, for the attribute-sampling
    (test-of-controls) example -- testing "was this PO properly approved."
    A known number of deviations (missing approval) are seeded in; check.py
    draws an actual random sample from this population and counts however
    many deviations really land in it -- not asserted in advance.
  - data/ar_population.csv: AR customer balances, for the monetary-unit
    (PPS/substantive) example. A few accounts are seeded with a real
    overstatement (audited_value < book_value); check.py performs actual
    systematic PPS selection over this population, so whether a seeded
    misstatement gets selected (and how the evaluation comes out) depends
    on where it happens to fall, not on a scripted outcome.

The synthetic data here only exists to make the sampling MATH concrete and
inspectable, unlike the reliability-factor methodology itself, which is
verified against real, published reference values (see check.py).

Usage:
    .venv/Scripts/python.exe generate_populations.py
"""

import random
from pathlib import Path

import pandas as pd

SEED = 20240922
DATA_DIR = Path(__file__).parent / "data"

N_PO = 3000
PO_DEVIATION_RATE = 0.018  # ~1.8% of POs are missing required approval

N_AR = 420
AR_MISSTATED_COUNT = 5


def main():
    rng = random.Random(SEED)

    # --- Purchase orders: attribute sampling population ---
    pos = []
    for i in range(1, N_PO + 1):
        deviates = rng.random() < PO_DEVIATION_RATE
        pos.append({
            "po_id": f"PO-{i:05d}",
            "approved": not deviates,
        })
    po_df = pd.DataFrame(pos)
    DATA_DIR.mkdir(exist_ok=True)
    po_df.to_csv(DATA_DIR / "po_population.csv", index=False)
    n_dev = int((~po_df["approved"]).sum())
    print(f"Wrote {len(po_df)} purchase orders to {DATA_DIR / 'po_population.csv'} "
          f"({n_dev} real seeded approval deviations, {n_dev / len(po_df):.2%})")

    # --- AR balances: MUS/PPS sampling population ---
    accounts = []
    for i in range(1, N_AR + 1):
        # Lognormal-ish spread of customer balances, comparable in shape to
        # this portfolio's other synthetic financial populations.
        book_value = round(max(150.0, rng.lognormvariate(8.6, 1.15)), 2)
        accounts.append({"account_id": f"AR-{i:04d}", "book_value": book_value,
                          "audited_value": book_value})
    misstated_idx = rng.sample(range(N_AR), AR_MISSTATED_COUNT)
    overstatement_pct = [0.85, 0.55, 0.30, 0.15, 0.08]  # varied severity, largest first
    for idx, pct in zip(misstated_idx, overstatement_pct):
        book = accounts[idx]["book_value"]
        accounts[idx]["audited_value"] = round(book * (1 - pct), 2)

    ar_df = pd.DataFrame(accounts)
    ar_df.to_csv(DATA_DIR / "ar_population.csv", index=False)
    total_value = ar_df["book_value"].sum()
    print(f"Wrote {len(ar_df)} AR accounts (${total_value:,.0f} total book value) to "
          f"{DATA_DIR / 'ar_population.csv'} ({AR_MISSTATED_COUNT} real seeded overstatements)")


if __name__ == "__main__":
    main()
