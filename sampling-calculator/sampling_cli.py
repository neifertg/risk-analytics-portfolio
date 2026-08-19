"""Thin CLI/stdin-JSON shim over sampling.py's pure functions, so the
audit-engagement-co-pilot MCP server (Node) can call this library across a
process boundary. sampling.py itself is untouched -- this only adapts its
existing functions to a stdin-JSON-in / stdout-JSON-out contract.

Usage: python sampling_cli.py <command> < payload.json
Commands: plan-attribute, evaluate-attribute, plan-mus, evaluate-mus
On success: prints the result dataclass as JSON, exits 0.
On error (bad/missing fields, or a real business-logic error like
sampling.py's own ValueError): prints {"error": "..."} as JSON, exits 1 --
never an uncaught traceback, so the caller always gets well-formed JSON.
"""
from __future__ import annotations

import json
import sys
from dataclasses import asdict

from sampling import (
    evaluate_attribute_sample,
    evaluate_mus_sample,
    plan_attribute_sample,
    plan_mus_sample,
)

COMMANDS = {
    "plan-attribute": lambda p: plan_attribute_sample(
        population_size=p["population_size"],
        confidence_level=p["confidence_level"],
        tolerable_rate=p["tolerable_rate"],
        expected_rate=p["expected_rate"],
    ),
    "evaluate-attribute": lambda p: evaluate_attribute_sample(
        sample_size=p["sample_size"],
        deviations_found=p["deviations_found"],
        confidence_level=p["confidence_level"],
        tolerable_rate=p["tolerable_rate"],
    ),
    "plan-mus": lambda p: plan_mus_sample(
        population_value=p["population_value"],
        confidence_level=p["confidence_level"],
        tolerable_misstatement=p["tolerable_misstatement"],
        expected_misstatement=p.get("expected_misstatement", 0.0),
    ),
    "evaluate-mus": lambda p: evaluate_mus_sample(
        sampling_interval=p["sampling_interval"],
        confidence_level=p["confidence_level"],
        tolerable_misstatement=p["tolerable_misstatement"],
        misstatements=p["misstatements"],
    ),
}


def fail(message: str) -> None:
    print(json.dumps({"error": message}))
    sys.exit(1)


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in COMMANDS:
        fail(f"usage: sampling_cli.py <{'|'.join(COMMANDS)}> < payload.json")
        return

    command = sys.argv[1]
    try:
        payload = json.loads(sys.stdin.read())
    except json.JSONDecodeError as e:
        fail(f"invalid JSON on stdin: {e}")
        return

    try:
        result = COMMANDS[command](payload)
    except KeyError as e:
        fail(f"missing required field: {e}")
        return
    except (ValueError, TypeError) as e:
        fail(str(e))
        return

    print(json.dumps(asdict(result)))


if __name__ == "__main__":
    main()
