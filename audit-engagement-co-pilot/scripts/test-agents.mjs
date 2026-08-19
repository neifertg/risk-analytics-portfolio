// Phase 2 acceptance script: each sub-agent tested alone (no supervisor
// yet -- that's Phase 3) against a couple of hand-written questions,
// through the real tool-use loop, over a real in-process MCP Client/Server
// pair, hitting the real Anthropic API. Same hand-rolled-script pattern as
// Phase 1's test-tools.mjs, not a framework test runner.
import { connectInProcessMcp } from "./mcp-bridge.mjs";
import { runSubAgent } from "./sub-agents.mjs";

let pass = 0;
let fail = 0;

function report(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " -- " + detail : ""}`);
  if (ok) pass++;
  else fail++;
}

function calledTool(result, toolName) {
  return result.trace.some((t) => t.tool === toolName && !t.isError);
}

const CASES = [
  {
    agent: "sampling",
    question:
      "I need a sample size for attribute sampling: population of 5000 items, 95% confidence, " +
      "tolerable deviation rate 5%, expected deviation rate 1%. What sample size do I need?",
    expectTool: "plan_audit_sample",
  },
  {
    agent: "sampling",
    question:
      "I tested a monetary-unit sample with a $50,000 sampling interval and a $200,000 tolerable " +
      "misstatement at 95% confidence. I found one misstatement: book value $500, audited value $300. " +
      "What's my conclusion?",
    expectTool: "evaluate_audit_sample",
  },
  {
    agent: "fraud-risk",
    question: "Are there any duplicate or split-payment flags in the AP ledger, and how many total?",
    expectTool: "check_duplicate_payments",
  },
  {
    agent: "fraud-risk",
    question: "How does the ML-based anomaly detection compare to the rule-based duplicate-payment checker?",
    expectTool: "get_fraud_ml_comparison",
  },
  {
    agent: "standards",
    question: "What is typically tested during a SOX walkthrough?",
    expectTool: "ask_audit_assistant",
  },
  {
    agent: "standards",
    question: "What does COSO say about the control environment component?",
    expectTool: "ask_audit_assistant",
  },
];

async function main() {
  const { client, server, mcpTools } = await connectInProcessMcp();

  let totalCostUsd = 0;

  for (const { agent, question, expectTool } of CASES) {
    const result = await runSubAgent(agent, question, { client, mcpTools });
    const costUsd =
      (result.usage.inputTokens / 1_000_000) * 1.0 + (result.usage.outputTokens / 1_000_000) * 5.0;
    totalCostUsd += costUsd;

    report(
      `${agent}: calls ${expectTool} for "${question.slice(0, 50)}..."`,
      calledTool(result, expectTool),
      `trace tools: ${result.trace.map((t) => t.tool).join(", ") || "(none)"}`
    );
    report(
      `${agent}: produces a non-trivial final answer`,
      result.terminatedReason === "end_turn" && result.answer.length > 20,
      `terminatedReason=${result.terminatedReason}, ${result.answer.length} chars`
    );
  }

  // Induced failure, agent-loop layer: an agent given a tool name Anthropic
  // will never emit (Claude only calls what's in its `tools` list) can't be
  // triggered from outside -- so induce it directly against the loop
  // primitive instead, with a callTool that always throws, confirming the
  // loop turns that into a tool_result-shaped failure instead of crashing.
  const { callAnthropicWithTools } = await import("./agent-loop.mjs");
  try {
    const forcedFailure = await callAnthropicWithTools({
      model: "claude-haiku-4-5-20251001",
      system: "You must call the get_time tool before answering anything.",
      messages: [{ role: "user", content: "What time is it?" }],
      tools: [
        {
          name: "get_time",
          description: "Get the current time. Always call this before answering.",
          input_schema: { type: "object", properties: {}, additionalProperties: false },
        },
      ],
      callTool: async () => {
        throw new Error("induced failure: get_time is intentionally broken");
      },
      maxTurns: 3,
    });
    const sawInducedError = forcedFailure.trace.some((t) => t.isError && t.result.includes("induced failure"));
    report(
      "agent-loop resolves a throwing callTool to a well-formed tool_result error, not a crash",
      sawInducedError,
      `trace: ${JSON.stringify(forcedFailure.trace)}`
    );
  } catch (err) {
    report("agent-loop resolves a throwing callTool to a well-formed tool_result error, not a crash", false, err.message);
  }

  await client.close();
  await server.close();

  console.log(`\nTotal real API spend this run: ~$${totalCostUsd.toFixed(5)}`);
  console.log(`${pass}/${pass + fail} passed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("test-agents: fatal error:", err);
  process.exit(1);
});
