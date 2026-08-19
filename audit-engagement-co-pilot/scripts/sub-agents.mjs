// Phase 2: the three specialist sub-agents, tested here in isolation (no
// supervisor yet -- that's Phase 3). Each gets only its own MCP tool(s) and
// a tight system prompt, matching the plan's "Haiku sub-agents, narrow
// scope" design -- see Seth_Wiki/projects/audit-engagement-co-pilot.md.
import { callAnthropicWithTools } from "./agent-loop.mjs";
import { mcpToolsToAnthropicTools, makeMcpCallTool } from "./mcp-bridge.mjs";

// Matches audit-rag-assistant/scripts/answer.mjs's existing model choice
// for this same reason: cheap, fast, sufficient for a narrow-scope agent.
const SUB_AGENT_MODEL = "claude-haiku-4-5-20251001";

const STATIC_DATA_REMINDER =
  "check_duplicate_payments, get_benfords_analysis, and get_fraud_ml_comparison are all " +
  "pre-computed on a seeded synthetic dataset as of the last portfolio update, not live " +
  "analysis of new data -- say so explicitly whenever you cite one of them, never imply " +
  "the numbers are current or computed on demand.";

export const SUB_AGENTS = {
  sampling: {
    name: "sampling",
    toolNames: ["plan_audit_sample", "evaluate_audit_sample"],
    systemPrompt: [
      "You are an audit-sampling specialist. You have two tools: plan_audit_sample",
      "(compute a required sample size before testing) and evaluate_audit_sample",
      "(evaluate results after testing, for either attribute sampling or",
      "monetary-unit/PPS sampling).",
      "Rules:",
      "- Always call the appropriate tool rather than computing or estimating a",
      "  sample size, deviation rate, or misstatement projection yourself.",
      "- Report the exact numbers the tool returns. Do not round or adjust them.",
      "- If the question is missing a required input (e.g. no tolerable rate given),",
      "  say plainly what's missing instead of guessing a value.",
      "- Keep the answer to a few sentences: the result, then a one-line plain-English",
      "  interpretation of what it means for the audit.",
    ].join("\n"),
  },
  "fraud-risk": {
    name: "fraud-risk",
    toolNames: ["check_duplicate_payments", "get_benfords_analysis", "get_fraud_ml_comparison"],
    systemPrompt: [
      "You are a fraud-risk specialist. You have three read-only tools:",
      "check_duplicate_payments (rule-based duplicate/split-payment flags),",
      "get_benfords_analysis (Benford's Law conformity on real SEC EDGAR data),",
      "and get_fraud_ml_comparison (Isolation Forest/DBSCAN vs. the rule-based checker).",
      "Rules:",
      "- " + STATIC_DATA_REMINDER,
      "- A close-conformity Benford's result is the expected, unsurprising baseline for a",
      "  healthy market-wide aggregate, not a fraud finding on its own -- don't overstate it.",
      "- get_fraud_ml_comparison is an evaluation/comparison artifact requiring ground-truth",
      "  labels, not a deployable blind detector -- don't describe it as one.",
      "- Call whichever tool(s) the question actually needs; don't call all three by default.",
    ].join("\n"),
  },
  standards: {
    name: "standards",
    toolNames: ["search_audit_standards", "ask_audit_assistant"],
    systemPrompt: [
      "You are an audit-standards specialist grounded in a COSO/IIA/SOX-methodology corpus.",
      "You have two tools: search_audit_standards (raw scored excerpts) and",
      "ask_audit_assistant (a guardrail-protected generated answer that refuses to guess",
      "when nothing relevant is retrieved).",
      "Rules:",
      "- Prefer ask_audit_assistant for a direct question; use search_audit_standards when",
      "  you need to see multiple raw excerpts yourself before answering.",
      "- Answer only from what the tools return. If ask_audit_assistant reports",
      "  guardrailTriggered: true, say plainly that the corpus doesn't cover the question",
      "  rather than filling the gap from outside knowledge.",
      "- Carry over citation markers (e.g. [1]) from tool output into your final answer.",
    ].join("\n"),
  },
};

// `mcpTools` is the full tool list from one connected MCP client (see
// mcp-bridge.mjs); each sub-agent only ever sees its own filtered subset in
// the `tools` param sent to Anthropic, so it can only choose to call tools
// it was actually told about, even though the underlying client can reach
// the whole server.
export async function runSubAgent(agentKey, question, { client, mcpTools }) {
  const agent = SUB_AGENTS[agentKey];
  if (!agent) throw new Error(`runSubAgent: unknown agent "${agentKey}"`);

  const ownMcpTools = mcpTools.filter((tool) => agent.toolNames.includes(tool.name));
  const tools = mcpToolsToAnthropicTools(ownMcpTools);
  const callTool = makeMcpCallTool(client);

  const { text, usage, trace, turns, terminatedReason } = await callAnthropicWithTools({
    model: SUB_AGENT_MODEL,
    system: agent.systemPrompt,
    messages: [{ role: "user", content: question }],
    tools,
    callTool,
  });

  return { agent: agentKey, question, answer: text.trim(), usage, trace, turns, terminatedReason };
}
