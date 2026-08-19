// Phase 3 acceptance script: the supervisor's hierarchical dispatch, tested
// against the real Anthropic API (Sonnet supervisor + Haiku sub-agents) --
// one single-specialist case, and one genuine fan-out + reconciliation case
// (the real differentiator per the plan: a question that legitimately needs
// both fraud-risk and standards, with tension the supervisor has to
// reconcile rather than silently pick a side). Also verifies the full
// multi-agent trace is present and that it lands in logs/queries.jsonl.
// Same hand-rolled-script pattern as Phase 1/2's test scripts.
import fs from "node:fs";
import { runSupervisor } from "./supervisor.mjs";
import { projectRoot } from "./lib.mjs";
import path from "node:path";

let pass = 0;
let fail = 0;

function report(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " -- " + detail : ""}`);
  if (ok) pass++;
  else fail++;
}

const LOG_PATH = path.join(projectRoot, "logs", "queries.jsonl");

async function main() {
  const logLinesBefore = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, "utf8").trim().split("\n").length : 0;

  let totalCostUsd = 0;

  // --- Case 1: single-specialist question, no fan-out needed -------------
  const single = await runSupervisor(
    "I need a sample size for attribute sampling: population 5000, 95% confidence, tolerable rate 5%, expected rate 1%."
  );
  totalCostUsd += single.usage.totalCostUsd;

  report(
    "single-specialist question dispatches to exactly sampling",
    single.dispatched.length === 1 && single.dispatched[0] === "sampling",
    `dispatched: ${single.dispatched.join(", ")}`
  );
  report(
    "single-specialist question produces a real final answer",
    single.terminatedReason === "end_turn" && single.answer.length > 20,
    `${single.answer.length} chars`
  );

  // --- Case 2: genuine fan-out + reconciliation ---------------------------
  const fanout = await runSupervisor(
    "Our duplicate-payment checker flagged several payments in the AP ledger. " +
      "Given that finding, what does COSO/IIA say we should do about a control " +
      "deficiency like this, and does the fraud-risk data actually show a real problem?"
  );
  totalCostUsd += fanout.usage.totalCostUsd;

  const dispatchedSet = new Set(fanout.dispatched);
  report(
    "fan-out question dispatches to both fraud-risk and standards",
    dispatchedSet.has("fraud-risk") && dispatchedSet.has("standards"),
    `dispatched: ${fanout.dispatched.join(", ")}`
  );
  report(
    "fan-out question produces a real synthesized final answer",
    fanout.terminatedReason === "end_turn" && fanout.answer.length > 20,
    `${fanout.answer.length} chars`
  );
  report(
    "fan-out trace records both sub-agent calls with their own nested traces",
    fanout.trace.subAgents.length >= 2 &&
      fanout.trace.subAgents.every((call) => Array.isArray(call.trace)),
    `${fanout.trace.subAgents.length} sub-agent calls`
  );
  report(
    "fan-out trace records the supervisor's own dispatch turns",
    Array.isArray(fanout.trace.supervisor) && fanout.trace.supervisor.length >= 2,
    `${fanout.trace.supervisor?.length ?? 0} supervisor tool calls`
  );

  // --- Trace logging -------------------------------------------------------
  const logLinesAfter = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, "utf8").trim().split("\n").length : 0;
  report(
    "both queries appended to logs/queries.jsonl",
    logLinesAfter === logLinesBefore + 2,
    `${logLinesBefore} -> ${logLinesAfter} lines`
  );

  const lastLine = fs.readFileSync(LOG_PATH, "utf8").trim().split("\n").at(-1);
  const lastEntry = JSON.parse(lastLine);
  report(
    "logged entry carries the full multi-agent trace and per-call cost",
    typeof lastEntry.usage?.totalCostUsd === "number" &&
      Array.isArray(lastEntry.trace?.subAgents) &&
      lastEntry.trace.subAgents.every((call) => typeof call.trace !== "undefined")
  );

  console.log(`\nTotal real API spend this run: ~$${totalCostUsd.toFixed(5)}`);
  console.log(`${pass}/${pass + fail} passed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("test-supervisor: fatal error:", err);
  process.exit(1);
});
