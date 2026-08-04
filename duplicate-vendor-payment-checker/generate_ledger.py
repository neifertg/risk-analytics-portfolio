"""Generates a synthetic accounts-payable ledger with deliberately seeded
duplicate-payment patterns, for check.py to detect.

Ground truth (data/ground_truth.json) records which payment_ids belong to
which seeded pattern, kept separate from data/ledger.csv — check.py's
detection logic never reads it. It exists purely so README findings can
report real precision/recall against known cases: the one thing labeled
synthetic data can do that a real engagement can't.

Usage:
    .venv/Scripts/python.exe generate_ledger.py
"""

import json
import random
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

SEED = 20240817
DATA_DIR = Path(__file__).parent / "data"

YEAR_START = date(2024, 1, 1)
YEAR_END = date(2024, 12, 31)
YEAR_DAYS = (YEAR_END - YEAR_START).days

APPROVAL_THRESHOLD = 10_000.0

VENDOR_PREFIXES = [
    "Summit", "Blue Ridge", "Meridian", "Cascade", "Harbor", "Union",
    "Vantage", "Keystone", "Silverline", "Northgate", "Falcon", "Ember",
    "Cobalt", "Redwood", "Ironclad", "Beacon", "Crestview", "Lumen",
    "Anchor", "Vertex", "Granite", "Pinehurst", "Coastal", "Highland",
    "Bridgeway",
]
VENDOR_SUFFIXES = [
    "Supply Co.", "Logistics", "Office Solutions", "IT Services",
    "Consulting Group", "Facilities Management", "Catering",
    "Security Systems", "Marketing Partners", "Software Inc.",
    "Utilities", "Legal Services", "Staffing Solutions",
    "Maintenance Corp", "Telecom", "Print & Design", "Waste Management",
    "Landscaping", "Insurance Group", "Travel Services",
    "Equipment Rental", "Freight", "Analytics", "Cleaning Services",
]

NAME_PERTURBATIONS = [
    lambda s: s.rstrip("."),
    lambda s: s + " LLC",
    lambda s: s.replace("Co.", "Company"),
    lambda s: s.replace("Inc.", "Incorporated"),
    lambda s: s.replace(" & ", " and "),
    lambda s: s + ",",
]


def make_vendors(rng, n=50):
    names = set()
    while len(names) < n:
        name = f"{rng.choice(VENDOR_PREFIXES)} {rng.choice(VENDOR_SUFFIXES)}"
        names.add(name)
    return sorted(names)


def random_date(rng):
    return YEAR_START + timedelta(days=int(rng.integers(0, YEAR_DAYS + 1)))


def random_amount(rng, low=50, high=48000):
    # Lognormal: many small/medium payments, a long tail of large ones.
    raw = rng.lognormal(mean=7.2, sigma=1.1)
    return float(np.clip(round(raw, 2), low, high))


def perturb_vendor_name(py_rng, name):
    variant = name
    for _ in range(3):
        transform = py_rng.choice(NAME_PERTURBATIONS)
        candidate = transform(variant)
        if candidate != variant:
            return candidate
    return variant + " LLC"


def make_invoice_number(rng, vendor_idx, used):
    while True:
        num = f"INV-{vendor_idx:03d}-{int(rng.integers(10000, 99999))}"
        if num not in used:
            used.add(num)
            return num


def main():
    rng = np.random.default_rng(SEED)
    py_rng = random.Random(SEED)

    vendors = make_vendors(rng)
    used_invoices = set()
    methods = ["ACH", "Check", "Wire", "Card"]
    method_weights = [0.55, 0.20, 0.15, 0.10]

    records = []
    by_id = {}
    ground_truth = []
    next_id = 1

    def add_record(vendor_name, invoice_number, amount, pay_date, method):
        nonlocal next_id
        pid = f"PMT-{next_id:05d}"
        next_id += 1
        rec = {
            "payment_id": pid,
            "vendor_name": vendor_name,
            "invoice_number": invoice_number,
            "amount": round(amount, 2),
            "payment_date": pay_date.isoformat(),
            "payment_method": method,
        }
        records.append(rec)
        by_id[pid] = rec
        return pid

    # --- Baseline legitimate payments ---
    N_BASE = 850
    base_pool = []  # (payment_id, vendor_idx, vendor_name, amount, date)
    for _ in range(N_BASE):
        vidx = int(rng.integers(0, len(vendors)))
        vendor = vendors[vidx]
        amount = random_amount(rng)
        pay_date = random_date(rng)
        method = py_rng.choices(methods, weights=method_weights)[0]
        inv = make_invoice_number(rng, vidx, used_invoices)
        pid = add_record(vendor, inv, amount, pay_date, method)
        base_pool.append((pid, vidx, vendor, amount, pay_date))

    # --- Seed: exact duplicates (same invoice paid twice) ---
    N_EXACT = 15
    for pid_orig, vidx, vendor, amount, pay_date in py_rng.sample(base_pool, N_EXACT):
        dup_date = pay_date + timedelta(days=int(rng.integers(1, 11)))
        if dup_date > YEAR_END:
            dup_date = pay_date - timedelta(days=int(rng.integers(1, 11)))
        orig_inv = by_id[pid_orig]["invoice_number"]
        pid_dup = add_record(vendor, orig_inv, amount, dup_date, py_rng.choice(methods))
        ground_truth.append({
            "type": "exact_duplicate", "confidence": "duplicate",
            "payment_ids": [pid_orig, pid_dup],
        })

    # --- Seed: threshold-avoidance / structured "split" payments ---
    N_SPLIT = 12
    for vidx in py_rng.sample(range(len(vendors)), N_SPLIT):
        vendor = vendors[vidx]
        base_date = random_date(rng)
        pids = []
        n_parts = py_rng.choice([2, 2, 2, 3])
        for _ in range(n_parts):
            amount = float(rng.uniform(APPROVAL_THRESHOLD * 0.90, APPROVAL_THRESHOLD - 10))
            pay_date = base_date + timedelta(days=int(rng.integers(0, 8)))
            if pay_date > YEAR_END:
                pay_date = YEAR_END
            inv = make_invoice_number(rng, vidx, used_invoices)
            pids.append(add_record(vendor, inv, amount, pay_date, py_rng.choice(methods)))
        ground_truth.append({
            "type": "threshold_split", "confidence": "duplicate",
            "payment_ids": pids,
        })

    # --- Seed: vendor-master duplicates (same invoice/amount, name variant) ---
    N_VENDOR_DUP = 10
    for pid_orig, vidx, vendor, amount, pay_date in py_rng.sample(base_pool, N_VENDOR_DUP):
        variant_name = perturb_vendor_name(py_rng, vendor)
        dup_date = pay_date + timedelta(days=int(rng.integers(1, 6)))
        if dup_date > YEAR_END:
            dup_date = pay_date - timedelta(days=int(rng.integers(1, 6)))
        orig_inv = by_id[pid_orig]["invoice_number"]
        pid_dup = add_record(variant_name, orig_inv, amount, dup_date, py_rng.choice(methods))
        ground_truth.append({
            "type": "vendor_master_duplicate", "confidence": "duplicate",
            "payment_ids": [pid_orig, pid_dup],
        })

    # --- Seed: round-trip near-duplicates (ambiguous review candidates) ---
    N_NEARDUP = 15
    for pid_orig, vidx, vendor, amount, pay_date in py_rng.sample(base_pool, N_NEARDUP):
        dup_date = pay_date + timedelta(days=int(rng.integers(6, 21)))
        if dup_date > YEAR_END:
            dup_date = pay_date - timedelta(days=int(rng.integers(6, 21)))
        inv = make_invoice_number(rng, vidx, used_invoices)
        pid_dup = add_record(vendor, inv, amount, dup_date, py_rng.choice(methods))
        ground_truth.append({
            "type": "round_trip_near_duplicate", "confidence": "review_candidate",
            "payment_ids": [pid_orig, pid_dup],
        })

    df = pd.DataFrame(records).sort_values("payment_date").reset_index(drop=True)

    DATA_DIR.mkdir(exist_ok=True)
    df.to_csv(DATA_DIR / "ledger.csv", index=False)
    (DATA_DIR / "ground_truth.json").write_text(json.dumps(ground_truth, indent=2))

    print(f"Wrote {len(df)} payment records to {DATA_DIR / 'ledger.csv'}")
    print(f"Seeded {len(ground_truth)} known duplicate/review groups to "
          f"{DATA_DIR / 'ground_truth.json'} (not read by check.py)")


if __name__ == "__main__":
    main()
