"""Generates a synthetic user-access-rights population with deliberately
seeded segregation-of-duties (SoD) conflicts, for check.py to detect.

Grounded in Seth_Wiki's segregation-of-duties-analysis.md resource note,
which draws a specific distinction this dataset is built to exercise both
sides of: role DESIGN (are roles themselves defined without conflicts) vs.
access-rights ANALYTICS (which actual people hold actual conflicting
combinations, "through role assignment, exception grants, or accumulated
access from a role change that was never revoked" -- the note's own
framing of "the real audit-analytics deliverable").

Three seeded scenarios, kept in data/ground_truth.json and never read by
check.py:
  - exception_grant_conflict: a clean base role plus one active exception
    grant for the other side of a conflict pair (accumulated access).
  - role_design_conflict: a legacy role that bundles both sides of a
    conflict pair by design, not through any individual exception.
  - remediated_conflict: an exception grant for the other side that was
    later REVOKED -- should NOT be flagged as of the analysis date. A
    true-negative case: conflicting *grant history* isn't the same as a
    conflicting *current* access state.

Usage:
    .venv/Scripts/python.exe generate_access_data.py
"""

import json
import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

SEED = 20240711
DATA_DIR = Path(__file__).parent / "data"
ANALYSIS_DATE = date(2024, 12, 31)
YEAR_START = date(2024, 1, 1)

# --- Role -> base access right(s), clean by design except the one legacy
# role deliberately seeded as a bad design (see CONFLICT_MATRIX below). ---
ROLE_RIGHTS = {
    "AP Clerk": ["Create/Edit Vendor Master"],
    "AP Supervisor": ["Approve Vendor Payment"],
    "Procurement Buyer": ["Create Purchase Order"],
    "Procurement Manager": ["Approve Purchase Order"],
    "Warehouse Receiving Clerk": ["Receive Goods"],
    "AR Clerk": ["Create/Edit Customer Master"],
    "AR Supervisor": ["Approve Credit Memo"],
    "Payroll Admin": ["Edit Payroll Rates/Hours"],
    "Payroll Manager": ["Approve Payroll Run"],
    "GL Accountant": ["Post Journal Entry"],
    "Controller": ["Approve Journal Entry"],
    "Treasury Analyst": ["Reconcile Bank Account"],
    "Treasury Manager": ["Approve Wire Transfer"],
}
# Role weights -- more clerks/individual contributors than approvers, a
# realistic org shape.
ROLE_WEIGHTS = {
    "AP Clerk": 20, "AP Supervisor": 4,
    "Procurement Buyer": 16, "Procurement Manager": 4,
    "Warehouse Receiving Clerk": 14,
    "AR Clerk": 16, "AR Supervisor": 4,
    "Payroll Admin": 8, "Payroll Manager": 3,
    "GL Accountant": 12, "Controller": 3,
    "Treasury Analyst": 6, "Treasury Manager": 2,
}
BAD_LEGACY_ROLE = "Legacy Regional Admin"
BAD_LEGACY_RIGHTS = ["Create/Edit Vendor Master", "Approve Vendor Payment"]

CONFLICT_MATRIX = [
    {"process": "Procure-to-Pay", "right_a": "Create/Edit Vendor Master", "right_b": "Approve Vendor Payment",
     "risk": "Ghost-vendor scheme: create a fictitious vendor and approve payments to it, alone."},
    {"process": "Procure-to-Pay", "right_a": "Create Purchase Order", "right_b": "Approve Purchase Order",
     "risk": "Self-approved purchase orders, bypassing independent authorization."},
    {"process": "Procure-to-Pay", "right_a": "Create Purchase Order", "right_b": "Receive Goods",
     "risk": "Fictitious receipt of goods that were never actually delivered."},
    {"process": "Order-to-Cash", "right_a": "Create/Edit Customer Master", "right_b": "Approve Credit Memo",
     "risk": "Fictitious customer plus a self-approved credit memo or write-off."},
    {"process": "Payroll", "right_a": "Edit Payroll Rates/Hours", "right_b": "Approve Payroll Run",
     "risk": "Unauthorized pay-rate change, self-approved in the same payroll run."},
    {"process": "Financial Close", "right_a": "Post Journal Entry", "right_b": "Approve Journal Entry",
     "risk": "Self-approved manual journal entry, bypassing independent review."},
]

N_USERS = 220
N_EXCEPTION_CONFLICT = 18
N_LEGACY_ROLE = 6
N_REMEDIATED = 10


def random_date(rng: random.Random, start: date, end: date) -> date:
    return start + timedelta(days=rng.randint(0, (end - start).days))


def main():
    rng = random.Random(SEED)

    roles = list(ROLE_WEIGHTS.keys())
    weights = [ROLE_WEIGHTS[r] for r in roles]

    users = []
    for i in range(1, N_USERS + 1):
        role = rng.choices(roles, weights=weights)[0]
        users.append({"user_id": f"U-{i:04d}", "base_role": role})

    grants = []
    ground_truth = []

    def add_grant(user_id, base_role, right, source, granted_date, revoked_date=None):
        grants.append({
            "user_id": user_id,
            "base_role": base_role,
            "access_right": right,
            "source": source,
            "granted_date": granted_date.isoformat(),
            "revoked_date": revoked_date.isoformat() if revoked_date else "",
        })

    # --- Baseline: every user gets their role's base right(s), clean ---
    for u in users:
        for right in ROLE_RIGHTS[u["base_role"]]:
            add_grant(u["user_id"], u["base_role"], right, f"role: {u['base_role']}",
                      random_date(rng, YEAR_START, date(2024, 3, 1)))

    # --- Seed: exception-grant conflict (accumulated access, still active) ---
    eligible_by_pair = {i: [] for i in range(len(CONFLICT_MATRIX))}
    for u in users:
        base_rights = set(ROLE_RIGHTS[u["base_role"]])
        for i, pair in enumerate(CONFLICT_MATRIX):
            if pair["right_a"] in base_rights and pair["right_b"] not in base_rights:
                eligible_by_pair[i].append((u["user_id"], u["base_role"], pair["right_b"]))
            elif pair["right_b"] in base_rights and pair["right_a"] not in base_rights:
                eligible_by_pair[i].append((u["user_id"], u["base_role"], pair["right_a"]))

    exception_targets = []
    per_pair_quota = N_EXCEPTION_CONFLICT // len(CONFLICT_MATRIX)
    for i in range(len(CONFLICT_MATRIX)):
        pool = eligible_by_pair[i]
        rng.shuffle(pool)
        exception_targets.extend(pool[:per_pair_quota])
    while len(exception_targets) < N_EXCEPTION_CONFLICT:
        i = rng.randrange(len(CONFLICT_MATRIX))
        pool = [c for c in eligible_by_pair[i] if c not in exception_targets]
        if pool:
            exception_targets.append(rng.choice(pool))

    for user_id, base_role, missing_right in exception_targets[:N_EXCEPTION_CONFLICT]:
        grant_date = random_date(rng, date(2024, 4, 1), date(2024, 10, 1))
        add_grant(user_id, base_role, missing_right, "exception grant", grant_date)
        ground_truth.append({"type": "exception_grant_conflict", "user_id": user_id})

    # --- Seed: role-design conflict (legacy role bundles both sides) ---
    remaining_users = [u for u in users if u["user_id"] not in {t[0] for t in exception_targets}]
    rng.shuffle(remaining_users)
    for u in remaining_users[:N_LEGACY_ROLE]:
        # Overwrite this user's role/grants: legacy role, both conflicting rights.
        grants[:] = [g for g in grants if g["user_id"] != u["user_id"]]
        for right in BAD_LEGACY_RIGHTS:
            add_grant(u["user_id"], BAD_LEGACY_ROLE, right, f"role: {BAD_LEGACY_ROLE}",
                      random_date(rng, YEAR_START, date(2024, 3, 1)))
        ground_truth.append({"type": "role_design_conflict", "user_id": u["user_id"]})

    # --- Seed: remediated conflict (exception grant later revoked) ---
    used_ids = {t[0] for t in exception_targets} | {u["user_id"] for u in remaining_users[:N_LEGACY_ROLE]}
    pool_for_remediation = []
    for i in range(len(CONFLICT_MATRIX)):
        pool_for_remediation.extend(
            (uid, role, right) for uid, role, right in eligible_by_pair[i] if uid not in used_ids
        )
    rng.shuffle(pool_for_remediation)
    seen = set()
    remediated = []
    for uid, role, right in pool_for_remediation:
        if uid in seen:
            continue
        seen.add(uid)
        remediated.append((uid, role, right))
        if len(remediated) == N_REMEDIATED:
            break

    for user_id, base_role, missing_right in remediated:
        grant_date = random_date(rng, date(2024, 2, 1), date(2024, 5, 1))
        revoke_date = grant_date + timedelta(days=rng.randint(30, 90))
        add_grant(user_id, base_role, missing_right, "exception grant", grant_date, revoke_date)
        ground_truth.append({"type": "remediated_conflict", "user_id": user_id})

    df = pd.DataFrame(grants).sort_values(["user_id", "granted_date"]).reset_index(drop=True)

    DATA_DIR.mkdir(exist_ok=True)
    df.to_csv(DATA_DIR / "access_grants.csv", index=False)
    (DATA_DIR / "conflict_matrix.json").write_text(json.dumps(CONFLICT_MATRIX, indent=2))
    (DATA_DIR / "ground_truth.json").write_text(json.dumps(ground_truth, indent=2))

    print(f"Wrote {len(df)} access-grant records for {N_USERS} users to {DATA_DIR / 'access_grants.csv'}")
    print(f"Seeded {len(ground_truth)} known conflict cases to "
          f"{DATA_DIR / 'ground_truth.json'} (not read by check.py)")


if __name__ == "__main__":
    main()
