// Phase 4: multi-agent evals over the real supervisor, extending
// audit-rag-assistant/scripts/eval.mjs's deterministic keyword-matching
// pattern -- no LLM-judge dependency, same as that file. What's new here
// isn't retrieval quality, it's the multi-step trace: did the supervisor
// pick the right sub-agent(s), did a genuine fan-out question actually
// dispatch to both specialists and get reconciled, does the static-tool
// "pre-computed on a seeded synthetic dataset" framing survive into the
// final synthesized answer, and does a real induced tool failure degrade
// gracefully instead of crashing the run.
import fs from "node:fs";
import path from "node:path";
import { runSupervisor } from "./supervisor.mjs";
import { projectRoot } from "./lib.mjs";

const casesPath = path.join(projectRoot, "evals", "cases.json");
const STATIC_CAVEAT_MARKERS = ["pre-computed", "precomputed", "synthetic", "seeded"];

function keywordsMatch(text, keywords) {
  if (!keywords || keywords.length === 0) return true;
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// Exact-set match by default -- for most cases, dispatching to exactly the
// right specialist(s) (no gratuitous fan-out) is itself part of what's
// being tested. `strictDispatch: false` relaxes this to "every expected
// agent was dispatched" for cases where dispatch discipline isn't the
// point -- e.g. the induced-failure case below, where the supervisor
// reasonably also consulted the standards specialist for a citation on top
// of the sampling specialist's answer, which is a legitimate judgment
// call, not a defect.
function dispatchMatches(actual, expected, strict) {
  const a = new Set(actual);
  const e = new Set(expected);
  if (strict === false) return [...e].every((v) => a.has(v));
  return a.size === e.size && [...e].every((v) => a.has(v));
}

// Every isError:true entry across every sub-agent's nested tool-call trace,
// regardless of which sub-agent produced it -- an induced-failure case can
// expect exactly one, and every other case should have exactly zero (an
// unexpected real tool failure in a "should just work" case is itself a bug
// worth catching, not something to silently ignore).
function collectToolErrors(trace) {
  return (trace.subAgents ?? []).flatMap((call) =>
    (call.trace ?? []).filter((t) => t.isError).map((t) => ({ agent: call.agent, tool: t.tool, result: t.result }))
  );
}

async function runCase(testCase) {
  const result = await runSupervisor(testCase.question);

  const dispatchCheck = dispatchMatches(result.dispatched, testCase.expectedDispatch, testCase.strictDispatch);
  const keywordCheck = keywordsMatch(result.answer, testCase.expectedKeywords);
  const toolErrors = collectToolErrors(result.trace);
  const expectFailure = testCase.induceFailure === true;
  const failureCheck = expectFailure ? toolErrors.length > 0 : toolErrors.length === 0;
  const staticCaveatCheck = testCase.expectStaticCaveat
    ? STATIC_CAVEAT_MARKERS.some((marker) => result.answer.toLowerCase().includes(marker))
    : true;
  // The whole point of an induced-failure case is that the run still
  // reaches a coherent final answer rather than throwing -- runSupervisor()
  // already didn't throw by the time we're here, so terminatedReason is the
  // remaining signal that it didn't just give up mid-loop.
  const gracefulCheck = expectFailure ? result.terminatedReason === "end_turn" : true;

  return { testCase, result, dispatchCheck, keywordCheck, failureCheck, staticCaveatCheck, gracefulCheck, toolErrors };
}

function printCase({ testCase, result, dispatchCheck, keywordCheck, failureCheck, staticCaveatCheck, gracefulCheck, toolErrors }) {
  const pass = dispatchCheck && keywordCheck && failureCheck && staticCaveatCheck && gracefulCheck;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`[${pass ? "PASS" : "FAIL"}] ${testCase.id} — ${testCase.question}`);
  if (!dispatchCheck) {
    console.log(`  dispatch: expected [${testCase.expectedDispatch.join(", ")}], got [${result.dispatched.join(", ")}]`);
  }
  if (!keywordCheck) {
    console.log(`  keywords: none of [${testCase.expectedKeywords.join(", ")}] found in final answer`);
  }
  if (!staticCaveatCheck) {
    console.log(`  static-caveat framing: none of [${STATIC_CAVEAT_MARKERS.join(", ")}] found in final answer`);
  }
  if (!failureCheck) {
    console.log(
      testCase.induceFailure
        ? "  induced failure: expected at least one isError tool call, got none"
        : `  unexpected tool error(s): ${toolErrors.map((e) => `${e.agent}/${e.tool}`).join(", ")}`
    );
  }
  if (!gracefulCheck) {
    console.log(`  graceful degradation: expected terminatedReason "end_turn", got "${result.terminatedReason}"`);
  }
  console.log(`  dispatched: ${result.dispatched.join(", ") || "(none)"}`);
  console.log(`\n  ANSWER:\n  ${result.answer.trim().replace(/\n/g, "\n  ")}`);
  console.log(`\n  cost: ~$${result.usage.totalCostUsd.toFixed(5)}`);
  return pass;
}

async function main() {
  const cases = JSON.parse(fs.readFileSync(casesPath, "utf8"));
  const results = [];
  let sessionCostUsd = 0;

  for (const testCase of cases) {
    const outcome = await runCase(testCase);
    sessionCostUsd += outcome.result.usage.totalCostUsd;
    results.push(printCase(outcome));
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`${passed}/${results.length} passed`);
  console.log(`session total cost: ~$${sessionCostUsd.toFixed(5)}`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(`eval: ${err.message}`);
  process.exit(1);
});
