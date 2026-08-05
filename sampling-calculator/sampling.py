"""Statistical audit sampling: attribute sampling (tests of controls) and
monetary-unit/PPS sampling (substantive testing of account balances).

Methodology and sourcing (see README.md "Methodology and sources" for the
full citation trail):

The core primitive both methods are built on is the AICPA Audit Sampling
Guide's "reliability factor" (also called a confidence/Poisson factor) --
the sample size (for a given confidence level and number of expected/actual
errors) that a Poisson-distributed error-count process requires. It has a
documented, exact closed-form relationship to the chi-square distribution:

    reliability_factor(k, confidence) = chi2.ppf(confidence, df=2*(k+1)) / 2

This module's reliability_factor() is verified in check.py against 10 real
published AICPA/PPS reliability-factor table values (the k=0 row across five
risk-of-incorrect-acceptance levels, and the k=0..4 rows at 5% risk) before
being used for anything else -- see check.py's verify_reliability_factors().

The IIA (Internal Auditor magazine, "2010 Attribute Sampling Plans") and
ISACA (IS Auditing Guideline G10: Audit Sampling) both direct auditors to
this same four-parameter statistical framework -- confidence level,
tolerable rate/misstatement, expected rate/misstatement, population --
rather than defining a competing set of formulas; the statistical mechanics
are shared across the profession, and what differs by standard-setter is
scope (financial-statement vs. internal vs. IS audit), not the underlying
math.

One honest scope limit: MUS/PPS planning sample size when expected
misstatement is nonzero uses a simplified, conservative adjustment (reduce
tolerable misstatement by expected misstatement before applying the
zero-misstatement reliability factor) rather than reproducing the AICPA
guide's more granular expected-misstatement expansion-factor table exactly
-- a worked example available during research produced a table value this
module's formula-based approach couldn't reproduce, and shipping an
unverified guess at that sub-table would contradict the point of grounding
this in verified methodology. Sample EVALUATION (both methods) and
zero-expected-error PLANNING use the exact, verified relationship -- only
this one planning adjustment is a labeled approximation.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from scipy.stats import chi2


def reliability_factor(k: int, confidence: float) -> float:
    """The AICPA/PPS reliability (confidence) factor for k Poisson-
    distributed occurrences at the given confidence level. Exact relationship
    to the chi-square distribution (see module docstring); verified against
    10 real published table values in check.py."""
    return chi2.ppf(confidence, df=2 * (k + 1)) / 2


# --- Attribute sampling (tests of controls) ---

@dataclass
class AttributeSamplePlan:
    population_size: int
    confidence_level: float
    tolerable_rate: float
    expected_rate: float
    sample_size: int
    expected_deviations: int


def plan_attribute_sample(population_size: int, confidence_level: float,
                           tolerable_rate: float, expected_rate: float) -> AttributeSamplePlan:
    """Smallest sample size n such that the reliability factor for the
    expected number of deviations in a sample of that size, divided by n,
    does not exceed the tolerable deviation rate. Iterative fixed point --
    the same construction used to build the classic AICPA attribute-
    sampling table."""
    k = 0
    n = None
    for _ in range(50):
        rf = reliability_factor(k, confidence_level)
        n_new = int(-(-rf // tolerable_rate))  # ceil
        k_new = round(expected_rate * n_new)
        if n_new == n and k_new == k:
            break
        n, k = n_new, k_new
    n = min(n, population_size) if population_size else n
    return AttributeSamplePlan(population_size, confidence_level, tolerable_rate,
                                expected_rate, n, k)


@dataclass
class AttributeSampleResult:
    sample_size: int
    deviations_found: int
    confidence_level: float
    tolerable_rate: float
    computed_upper_deviation_rate: float
    conclusion: str


def evaluate_attribute_sample(sample_size: int, deviations_found: int,
                               confidence_level: float, tolerable_rate: float) -> AttributeSampleResult:
    """Computed upper deviation rate (CUDR) = reliability_factor(deviations
    found, confidence) / sample size. If CUDR <= tolerable rate, the control
    can be relied on at the stated confidence; otherwise it can't."""
    cudr = reliability_factor(deviations_found, confidence_level) / sample_size
    conclusion = ("Control can be relied on at the stated confidence."
                  if cudr <= tolerable_rate
                  else "Control cannot be relied on at the stated confidence -- CUDR exceeds tolerable rate.")
    return AttributeSampleResult(sample_size, deviations_found, confidence_level,
                                  tolerable_rate, cudr, conclusion)


# --- Monetary-unit / PPS sampling (substantive testing) ---

@dataclass
class MUSSamplePlan:
    population_value: float
    confidence_level: float
    tolerable_misstatement: float
    expected_misstatement: float
    sample_size: int
    sampling_interval: float
    approximated_expansion: bool


def plan_mus_sample(population_value: float, confidence_level: float,
                     tolerable_misstatement: float, expected_misstatement: float = 0.0) -> MUSSamplePlan:
    """PPS sample size = population value x reliability_factor(0, confidence)
    / tolerable misstatement, exact per AICPA methodology when expected
    misstatement is 0. With nonzero expected misstatement, this applies a
    labeled simplification (see module docstring) rather than the AICPA
    guide's precise expansion-factor table."""
    rf0 = reliability_factor(0, confidence_level)
    approximated = expected_misstatement > 0
    effective_tolerable = tolerable_misstatement - expected_misstatement
    if effective_tolerable <= 0:
        raise ValueError("Expected misstatement must be less than tolerable misstatement.")
    n = int(-(-(population_value * rf0) // effective_tolerable))  # ceil
    interval = population_value / n
    return MUSSamplePlan(population_value, confidence_level, tolerable_misstatement,
                          expected_misstatement, n, interval, approximated)


def select_pps_sample(items: list[dict], sampling_interval: float, start_offset: float,
                       value_key: str = "book_value") -> list[dict]:
    """Systematic monetary-unit (cumulative monetary amount) selection: walk
    the population's cumulative dollar total and take the item covering
    each `start_offset + i * sampling_interval` hit, for i = 0, 1, 2, ...
    Standard PPS mechanical selection method -- unambiguous, not part of
    the reliability-factor verification above."""
    selected = []
    cumulative = 0.0
    hits = []
    hit = start_offset
    total = sum(item[value_key] for item in items)
    while hit < total:
        hits.append(hit)
        hit += sampling_interval

    hit_idx = 0
    for item in items:
        if hit_idx >= len(hits):
            break
        cumulative += item[value_key]
        while hit_idx < len(hits) and hits[hit_idx] < cumulative:
            selected.append(item)
            hit_idx += 1
    return selected


@dataclass
class MUSSampleResult:
    sample_size: int
    sampling_interval: float
    confidence_level: float
    tolerable_misstatement: float
    basic_precision: float
    projected_misstatement: float
    incremental_allowance: float
    upper_misstatement_limit: float
    conclusion: str


def evaluate_mus_sample(sampling_interval: float, confidence_level: float,
                         tolerable_misstatement: float,
                         misstatements: list[dict]) -> MUSSampleResult:
    """misstatements: list of {"book_value": ..., "audited_value": ...} for
    every misstated item found in the selected sample (any item, not just
    ones that happened to be a PPS "hit" -- consistent with standard PPS
    evaluation, which ranks all identified misstatements by tainting).

    basic_precision = sampling_interval x RF(0, confidence) -- the upper
    bound contribution from finding zero errors at all.
    For each misstatement (largest tainting first): tainting = (book -
    audited) / book; projected_misstatement = tainting x sampling_interval;
    incremental_allowance = projected_misstatement x [RF(rank, confidence) -
    RF(rank - 1, confidence)] (rank = 1 for the largest, 2 for the next, ...).
    upper_misstatement_limit = basic_precision + sum(projected_misstatement)
    + sum(incremental_allowance).
    """
    n = 0  # sample_size not needed for the formula itself; supplied by caller for the record
    basic_precision = sampling_interval * reliability_factor(0, confidence_level)

    tainted = []
    for m in misstatements:
        book, audited = m["book_value"], m["audited_value"]
        if book <= 0:
            continue
        tainting = (book - audited) / book
        if tainting <= 0:
            continue
        tainted.append(tainting)
    tainted.sort(reverse=True)

    total_projected = 0.0
    total_incremental = 0.0
    prior_rf = reliability_factor(0, confidence_level)
    for rank, tainting in enumerate(tainted, start=1):
        projected = min(tainting, 1.0) * sampling_interval
        this_rf = reliability_factor(rank, confidence_level)
        incremental = projected * (this_rf - prior_rf)
        total_projected += projected
        total_incremental += incremental
        prior_rf = this_rf

    uml = basic_precision + total_projected + total_incremental
    conclusion = ("Account balance supported at the stated confidence -- UML within tolerable misstatement."
                  if uml <= tolerable_misstatement
                  else "Account balance NOT supported at the stated confidence -- UML exceeds tolerable misstatement.")
    return MUSSampleResult(n, sampling_interval, confidence_level, tolerable_misstatement,
                            basic_precision, total_projected, total_incremental, uml, conclusion)
