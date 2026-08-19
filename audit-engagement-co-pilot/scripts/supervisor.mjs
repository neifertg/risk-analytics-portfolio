// Phase 3: the supervisor -- hierarchical dispatch over the three Phase 2
// sub-agents, plus full multi-agent trace logging. The supervisor never
// touches the raw MCP tools directly; its only tools are one `dispatch_*`
// per sub-agent (per the plan in Seth_Wiki/projects/audit-engagement-co-pilot.md).
// A dispatch call triggers a full nested Haiku tool-use loop (sub-agents.mjs);
// the sub-agent's final text becomes the tool_result the supervisor sees.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callAnthropicWithTools } from "./agent-loop.mjs";
import { connectInProcessMcp } from "./mcp-bridge.mjs";
import { runSubAgent } from "./sub-agents.mjs";
import { estimateCostUsd } from "./cost.mjs";
import { projectRoot } from "./lib.mjs";

const SUPERVISOR_MODEL = "claude-sonnet-5";
const LOG_PATH = path.join(projectRoot, "logs", "queries.jsonl");

const SUPERVISOR_SYSTEM_PROMPT = [
  "You are the supervisor of an audit engagement co-pilot. You decompose a",
  "plain-language audit question and dispatch it to three specialist",
  "sub-agents -- you never see or call their underlying tools directly:",
  "- dispatch_sampling: audit-sampling methodology (sample-size planning,",
  "  evaluating sample results).",
  "- dispatch_fraud_risk: fraud-risk analytics (duplicate-payment flags,",
  "  Benford's Law conformity, rule-based vs. ML anomaly-detection comparison",
  "  -- all pre-computed on a seeded synthetic dataset, never live analysis).",
  "- dispatch_standards: COSO/IIA/SOX audit-standards methodology, grounded",
  "  and cited against a corpus.",
  "Rules:",
  "- Decompose the question first. If it only needs one specialist, dispatch",
  "  to just that one.",
  "- If the question genuinely needs more than one specialist -- for example",
  "  it asks about fraud risk AND what the standards require in response --",
  "  dispatch to all of them that apply in the same turn, not one at a time.",
  "- When two sub-agents' answers touch the same point, explicitly reconcile",
  "  them in your final answer: state where they agree, and if they seem to",
  "  point in different directions, say so plainly rather than silently",
  "  picking one side.",
  "- Preserve every caveat a sub-agent gives you (e.g. that fraud-risk data",
  "  is pre-computed on a seeded synthetic dataset, or that the standards",
  "  corpus didn't cover something) -- carry it into your final answer rather",
  "  than dropping it for concision.",
  "- Write your final answer as a synthesis for the person who asked, citing",
  "  which specialist(s) each part of the answer came from.",
].join("\n");

const DISPATCH_TOOLS = [
  {
    name: "dispatch_sampling",
    description:
      "Dispatch a question to the audit-sampling specialist sub-agent (attribute sampling sample-size planning/evaluation, monetary-unit/PPS sampling). Pass the exact sub-question this specialist should answer, including every number it needs.",
    input_schema: {
      type: "object",
      properties: { question: { type: "string", description: "The sub-question for the sampling specialist" } },
      required: ["question"],
      additionalProperties: false,
    },
  },
  {
    name: "dispatch_fraud_risk",
    description:
      "Dispatch a question to the fraud-risk specialist sub-agent (duplicate-payment flags, Benford's Law conformity, rule-based vs. ML anomaly-detection comparison -- all pre-computed on a seeded synthetic dataset). Pass the exact sub-question this specialist should answer.",
    input_schema: {
      type: "object",
      properties: { question: { type: "string", description: "The sub-question for the fraud-risk specialist" } },
      required: ["question"],
      additionalProperties: false,
    },
  },
  {
    name: "dispatch_standards",
    description:
      "Dispatch a question to the audit-standards specialist sub-agent (COSO/IIA/SOX methodology, grounded and cited against a corpus). Pass the exact sub-question this specialist should answer.",
    input_schema: {
      type: "object",
      properties: { question: { type: "string", description: "The sub-question for the standards specialist" } },
      required: ["question"],
      additionalProperties: false,
    },
  },
];

export const AGENT_KEY_BY_TOOL = {
  dispatch_sampling: "sampling",
  dispatch_fraud_risk: "fraud-risk",
  dispatch_standards: "standards",
};

function logSupervisorQuery(entry) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + "\n");
}

// Runs one top-level question through the supervisor. Opens its own
// in-process MCP connection (one per call, matching Phase 1/2's pattern --
// the server is cheap to stand up and this keeps calls independent) and
// always logs, win or lose.
export async function runSupervisor(question) {
  const { client, server, mcpTools } = await connectInProcessMcp();

  const subAgentCalls = [];

  const dispatchCallTool = async (toolName, input) => {
    const agentKey = AGENT_KEY_BY_TOOL[toolName];
    if (!agentKey) throw new Error(`supervisor: unknown dispatch tool "${toolName}"`);
    const result = await runSubAgent(agentKey, input.question, { client, mcpTools });
    subAgentCalls.push(result);
    return result.answer;
  };

  let supervisorResult;
  try {
    supervisorResult = await callAnthropicWithTools({
      model: SUPERVISOR_MODEL,
      system: SUPERVISOR_SYSTEM_PROMPT,
      messages: [{ role: "user", content: question }],
      tools: DISPATCH_TOOLS,
      callTool: dispatchCallTool,
      maxTurns: 6,
    });
  } finally {
    await client.close();
    await server.close();
  }

  const supervisorCostUsd = estimateCostUsd(SUPERVISOR_MODEL, supervisorResult.usage);
  const subAgentCostUsd = subAgentCalls.reduce((sum, call) => sum + estimateCostUsd("claude-haiku-4-5", call.usage), 0);
  const totalCostUsd = supervisorCostUsd + subAgentCostUsd;

  const trace = {
    supervisor: supervisorResult.trace,
    subAgents: subAgentCalls.map(({ agent, question: subQuestion, answer, trace: subTrace, turns, terminatedReason }) => ({
      agent,
      question: subQuestion,
      answer,
      trace: subTrace,
      turns,
      terminatedReason,
    })),
  };

  const result = {
    question,
    answer: supervisorResult.text.trim(),
    trace,
    dispatched: [...new Set(subAgentCalls.map((call) => call.agent))],
    turns: supervisorResult.turns,
    terminatedReason: supervisorResult.terminatedReason,
    usage: {
      supervisor: { ...supervisorResult.usage, costUsd: supervisorCostUsd },
      subAgents: subAgentCalls.map((call) => ({
        agent: call.agent,
        ...call.usage,
        costUsd: estimateCostUsd("claude-haiku-4-5", call.usage),
      })),
      totalCostUsd,
    },
  };

  logSupervisorQuery(result);
  return result;
}

function parseArgs(args) {
  const asJson = args.includes("--json");
  const question = args.filter((arg) => arg !== "--json").join(" ").trim();
  return { asJson, question };
}

async function main() {
  const { asJson, question } = parseArgs(process.argv.slice(2));
  if (!question) {
    console.error('supervisor: usage: npm run ask-supervisor -- "your question" [--json]');
    process.exit(1);
  }

  const result = await runSupervisor(question);

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(result.answer);
  console.log(`\nDispatched to: ${result.dispatched.join(", ") || "(none)"}`);
  console.log(`Total cost: ~$${result.usage.totalCostUsd.toFixed(5)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`supervisor: ${err.message}`);
    process.exit(1);
  });
}
