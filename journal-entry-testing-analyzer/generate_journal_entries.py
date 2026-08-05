"""Generates a synthetic general-ledger journal-entry population with
deliberately seeded fraud-risk red flags, for check.py to detect.

The five red-flag categories are lifted directly from the "Common risk
criteria" list in Seth_Wiki's journal-entry-testing.md resource note, which
is itself sourced from AU-C 240 / PCAOB AS 2401's journal-entry-testing
requirement.

Ground truth (data/ground_truth.json) records which entry_ids were seeded
as which red-flag type, kept separate from data/journal_entries.csv —
check.py's detection logic never reads it. It exists purely so README
findings can report real precision/recall against known cases.

Each seeded category varies exactly one dimension (who posted it, when,
the amount/description, or the account pair) while keeping everything else
looking like a normal entry — an isolation design so each heuristic is
tested against a clean signal, with any overlap between categories left to
emerge naturally rather than being engineered in.

Usage:
    .venv/Scripts/python.exe generate_journal_entries.py
"""

import json
import random
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

SEED = 20240304
DATA_DIR = Path(__file__).parent / "data"

YEAR_START = date(2024, 1, 1)
YEAR_END = date(2024, 12, 31)
YEAR_DAYS = (YEAR_END - YEAR_START).days

HOLIDAYS_2024 = {
    date(2024, 1, 1), date(2024, 1, 15), date(2024, 2, 19),
    date(2024, 5, 27), date(2024, 6, 19), date(2024, 7, 4),
    date(2024, 9, 2), date(2024, 10, 14), date(2024, 11, 11),
    date(2024, 11, 28), date(2024, 12, 25),
}

# --- Normal preparer roster (role-based, not named individuals) ---
NORMAL_PREPARERS = (
    [f"AP Clerk {i}" for i in range(1, 4)]
    + [f"AR Clerk {i}" for i in range(1, 3)]
    + [f"Payroll Admin {i}" for i in range(1, 3)]
    + [f"GL Accountant {i}" for i in range(1, 5)]
    + [f"Staff Accountant {i}" for i in range(1, 5)]
    + [f"Senior Accountant {i}" for i in range(1, 4)]
)
# Rare personas: only ever used for seeded unusual_preparer entries, never
# in the baseline population -- "users who don't normally post journal
# entries, or senior personnel who could override normal review."
RARE_PREPARERS = [
    "Controller (Manual Override)",
    "IT System Admin",
    "Former Employee -- Access Not Revoked",
]
APPROVERS = ["Assistant Controller", "Controller", "CFO"]

# (source_system, debit_account, credit_account) -- the normal, subledger-
# driven combinations that make up routine transaction processing.
NORMAL_PAIRS = [
    ("AP", "Operating Expense", "Accounts Payable"),
    ("AP", "Accounts Payable", "Cash"),
    ("AR", "Accounts Receivable", "Revenue"),
    ("AR", "Cash", "Accounts Receivable"),
    ("Payroll", "Payroll Expense", "Cash"),
    ("Payroll", "Payroll Expense", "Accrued Payroll Liabilities"),
    ("Fixed Assets", "Fixed Assets", "Cash"),
    ("Fixed Assets", "Depreciation Expense", "Accumulated Depreciation"),
    ("Inventory", "Inventory", "Accounts Payable"),
    ("Inventory", "Cost of Goods Sold", "Inventory"),
    ("Treasury", "Cash", "Notes Payable"),
    ("Treasury", "Interest Expense", "Cash"),
    ("Tax", "Income Tax Expense", "Income Tax Payable"),
    ("Prepaids", "Prepaid Expenses", "Cash"),
    ("Prepaids", "Operating Expense", "Prepaid Expenses"),
]
# Rare pairs: only used for seeded unusual_account_combination entries --
# top-side/manual adjustments with no operational source system behind
# them, several bypassing the subledger a real transaction would go
# through (e.g. crediting Revenue directly instead of through AR).
RARE_PAIRS = [
    ("Revenue", "Retained Earnings"),
    ("Cash", "Revenue"),
    ("Accrued Payroll Liabilities", "Equity"),
    ("Accumulated Depreciation", "Revenue"),
]

DESCRIPTION_TEMPLATES = {
    "AP": ["AP invoice payment, ref {n}", "Vendor invoice accrual, ref {n}"],
    "AR": ["Customer invoice #{n}", "Cash receipt applied, invoice #{n}"],
    "Payroll": ["Biweekly payroll run, PPE {d}", "Payroll accrual, period {d}"],
    "Fixed Assets": ["Asset acquisition, tag #{n}", "Monthly depreciation expense, tag #{n}"],
    "Inventory": ["Inventory receipt, PO #{n}", "COGS relief, shipment #{n}"],
    "Treasury": ["Line-of-credit draw, ref {n}", "Monthly interest accrual"],
    "Tax": ["Quarterly income tax provision"],
    "Prepaids": ["Prepaid insurance amortization, {d}", "Prepaid software amortization, {d}"],
}
WEAK_DESCRIPTIONS = ["", "Adjustment", "Reclass", "TBD", "See attached", "Correction"]
ROUND_AMOUNTS = [1000, 2500, 5000, 7500, 10000, 15000, 20000, 25000, 50000]


def is_business_day(d: date) -> bool:
    return d.weekday() < 5 and d not in HOLIDAYS_2024


def random_business_date(rng: np.random.Generator) -> date:
    while True:
        d = YEAR_START + timedelta(days=int(rng.integers(0, YEAR_DAYS + 1)))
        if is_business_day(d):
            return d


def random_weekend_or_holiday_date(rng: np.random.Generator) -> date:
    while True:
        d = YEAR_START + timedelta(days=int(rng.integers(0, YEAR_DAYS + 1)))
        if not is_business_day(d):
            return d


def random_period_end_date(rng: np.random.Generator) -> date:
    """A business day within the last 2 calendar days of a random month."""
    month = int(rng.integers(1, 13))
    year = 2024
    if month == 12:
        month_end = YEAR_END
    else:
        month_end = date(year, month + 1, 1) - timedelta(days=1)
    for offset in (0, 1, 2, 3, 4):
        candidate = month_end - timedelta(days=offset)
        if candidate >= YEAR_START and is_business_day(candidate):
            return candidate
    return month_end


def random_amount(rng: np.random.Generator, low=50, high=250_000) -> float:
    raw = rng.lognormal(mean=6.5, sigma=1.3)
    return float(np.clip(round(raw, 2), low, high))


def main():
    rng = np.random.default_rng(SEED)
    py_rng = random.Random(SEED)

    preparer_weights = np.array([1.0 / (i + 1) ** 0.35 for i in range(len(NORMAL_PREPARERS))])
    preparer_weights /= preparer_weights.sum()

    records = []
    ground_truth = []
    next_id = 1

    def add_entry(entry_date, preparer, source_system, debit, credit, amount, description):
        nonlocal next_id
        eid = f"JE-{next_id:05d}"
        next_id += 1
        records.append({
            "entry_id": eid,
            "entry_date": entry_date.isoformat(),
            "prepared_by": preparer,
            "approved_by": py_rng.choice(APPROVERS),
            "source_system": source_system,
            "debit_account": debit,
            "credit_account": credit,
            "amount": round(amount, 2),
            "description": description,
        })
        return eid

    # --- Baseline: normal, routine journal entries ---
    N_BASE = 2500
    for _ in range(N_BASE):
        preparer = py_rng.choices(NORMAL_PREPARERS, weights=preparer_weights.tolist())[0]
        system, debit, credit = py_rng.choice(NORMAL_PAIRS)
        entry_date = random_business_date(rng)
        amount = random_amount(rng)
        template = py_rng.choice(DESCRIPTION_TEMPLATES[system])
        description = template.format(n=int(rng.integers(1000, 99999)), d=entry_date.isoformat())
        add_entry(entry_date, preparer, system, debit, credit, amount, description)

    # --- Seed: unusual preparer (rare persona, otherwise normal entry) ---
    N_UNUSUAL_PREPARER = 15
    for _ in range(N_UNUSUAL_PREPARER):
        preparer = py_rng.choice(RARE_PREPARERS)
        system, debit, credit = py_rng.choice(NORMAL_PAIRS)
        entry_date = random_business_date(rng)
        amount = random_amount(rng)
        template = py_rng.choice(DESCRIPTION_TEMPLATES[system])
        description = template.format(n=int(rng.integers(1000, 99999)), d=entry_date.isoformat())
        eid = add_entry(entry_date, preparer, system, debit, credit, amount, description)
        ground_truth.append({"type": "unusual_preparer", "confidence": "review_candidate", "entry_id": eid})

    # --- Seed: weekend/holiday posting (normal preparer, unusual date) ---
    N_WEEKEND_HOLIDAY = 18
    for _ in range(N_WEEKEND_HOLIDAY):
        preparer = py_rng.choices(NORMAL_PREPARERS, weights=preparer_weights.tolist())[0]
        system, debit, credit = py_rng.choice(NORMAL_PAIRS)
        entry_date = random_weekend_or_holiday_date(rng)
        amount = random_amount(rng)
        template = py_rng.choice(DESCRIPTION_TEMPLATES[system])
        description = template.format(n=int(rng.integers(1000, 99999)), d=entry_date.isoformat())
        eid = add_entry(entry_date, preparer, system, debit, credit, amount, description)
        ground_truth.append({"type": "weekend_or_holiday_posting", "confidence": "flag", "entry_id": eid})

    # --- Seed: period-end/cutoff timing (normal preparer, normal pair) ---
    N_PERIOD_END = 18
    for _ in range(N_PERIOD_END):
        preparer = py_rng.choices(NORMAL_PREPARERS, weights=preparer_weights.tolist())[0]
        system, debit, credit = py_rng.choice(NORMAL_PAIRS)
        entry_date = random_period_end_date(rng)
        amount = random_amount(rng)
        template = py_rng.choice(DESCRIPTION_TEMPLATES[system])
        description = template.format(n=int(rng.integers(1000, 99999)), d=entry_date.isoformat())
        eid = add_entry(entry_date, preparer, system, debit, credit, amount, description)
        ground_truth.append({"type": "period_end_cutoff", "confidence": "flag", "entry_id": eid})

    # --- Seed: round-dollar amount + weak/missing description ---
    N_ROUND_DOLLAR = 20
    for _ in range(N_ROUND_DOLLAR):
        preparer = py_rng.choices(NORMAL_PREPARERS, weights=preparer_weights.tolist())[0]
        system, debit, credit = py_rng.choice(NORMAL_PAIRS)
        entry_date = random_business_date(rng)
        amount = float(py_rng.choice(ROUND_AMOUNTS))
        description = py_rng.choice(WEAK_DESCRIPTIONS)
        eid = add_entry(entry_date, preparer, system, debit, credit, amount, description)
        ground_truth.append({"type": "round_dollar_weak_description", "confidence": "flag", "entry_id": eid})

    # --- Seed: unusual account combination (rare/top-side pair) ---
    N_UNUSUAL_COMBO = 15
    for _ in range(N_UNUSUAL_COMBO):
        preparer = py_rng.choices(NORMAL_PREPARERS, weights=preparer_weights.tolist())[0]
        debit, credit = py_rng.choice(RARE_PAIRS)
        entry_date = random_business_date(rng)
        amount = random_amount(rng)
        description = f"Manual top-side adjustment, ref {int(rng.integers(1000, 99999))}"
        eid = add_entry(entry_date, preparer, "Manual/Topside", debit, credit, amount, description)
        ground_truth.append({"type": "unusual_account_combination", "confidence": "review_candidate", "entry_id": eid})

    df = pd.DataFrame(records).sort_values("entry_date").reset_index(drop=True)

    DATA_DIR.mkdir(exist_ok=True)
    df.to_csv(DATA_DIR / "journal_entries.csv", index=False)
    (DATA_DIR / "ground_truth.json").write_text(json.dumps(ground_truth, indent=2))

    print(f"Wrote {len(df)} journal entries to {DATA_DIR / 'journal_entries.csv'}")
    print(f"Seeded {len(ground_truth)} known red-flag entries to "
          f"{DATA_DIR / 'ground_truth.json'} (not read by check.py)")


if __name__ == "__main__":
    main()
