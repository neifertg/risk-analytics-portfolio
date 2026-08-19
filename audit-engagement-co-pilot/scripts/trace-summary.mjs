// Turns runSupervisor()'s full nested trace (already collected for
// logs/queries.jsonl) into something the demo UI can render directly --
// one step per specialist dispatched, its own tool calls, and a deduped
// citation list pulled out of the RAG tools' results -- without the client
// having to know each tool's result shape or re-parse JSON-in-JSON itself.
import { allTools } from "./tools.mjs";
import { AGENT_KEY_BY_TOOL } from "./supervisor.mjs";
import { MIN_RETRIEVAL_SCORE } from "../../audit-rag-assistant/scripts/search.mjs";

const TOOL_LABELS = Object.fromEntries(allTools.map((t) => [t.name, t.config.title]));

const STATIC_TOOL_NAMES = new Set(["check_duplicate_payments", "get_benfords_analysis", "get_fraud_ml_comparison"]);

const AGENT_LABELS = {
  sampling: "Sampling Specialist",
  "fraud-risk": "Fraud-Risk Specialist",
  standards: "Standards Specialist",
};

// Matches sub-agents.mjs's SUB_AGENT_MODEL -- not imported directly since
// that file also pulls in agent-loop.mjs/mcp-bridge.mjs, more than this
// summarizer needs.
const SUB_AGENT_MODEL = "claude-haiku-4-5";

const EXCERPT_LIMIT = 800;

function truncate(text) {
  if (typeof text !== "string") return text;
  return text.length > EXCERPT_LIMIT ? `${text.slice(0, EXCERPT_LIMIT)}…` : text;
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Only search_audit_standards and ask_audit_assistant carry real citations
// (title/heading/corpus back to a specific wiki note) -- every other tool
// returns pre-computed analysis data, not a document to cite.
function citationsFromToolResult(toolName, resultText) {
  const parsed = safeParseJson(resultText);
  if (!parsed) return [];

  if (toolName === "search_audit_standards" && Array.isArray(parsed)) {
    return parsed.map((r) => ({ title: r.title, heading: r.heading, corpus: r.corpusSource, score: r.score }));
  }

  if (toolName === "ask_audit_assistant" && Array.isArray(parsed.sources)) {
    return parsed.sources.map((s) => ({ title: s.title, heading: s.heading, corpus: s.corpusSource }));
  }

  return [];
}

export function summarizeRun(result) {
  const usageByAgent = Object.fromEntries(result.usage.subAgents.map((u) => [u.agent, u]));
  const citationMap = new Map();

  const steps = result.trace.supervisor
    .filter((call) => call.tool in AGENT_KEY_BY_TOOL)
    .map((call) => {
      const agentKey = AGENT_KEY_BY_TOOL[call.tool];
      const subAgentTrace = result.trace.subAgents.find((sa) => sa.agent === agentKey);
      const usage = usageByAgent[agentKey];

      const toolCalls = (subAgentTrace?.trace ?? []).map((t) => {
        for (const citation of citationsFromToolResult(t.tool, t.result)) {
          citationMap.set(`${citation.title}::${citation.heading}`, citation);
        }
        return {
          tool: t.tool,
          label: TOOL_LABELS[t.tool] ?? t.tool,
          static: STATIC_TOOL_NAMES.has(t.tool),
          input: t.input,
          isError: t.isError,
          resultExcerpt: truncate(t.result ?? ""),
        };
      });

      return {
        agent: agentKey,
        agentLabel: AGENT_LABELS[agentKey] ?? agentKey,
        model: SUB_AGENT_MODEL,
        question: call.input?.question ?? "",
        turns: subAgentTrace?.turns ?? null,
        costUsd: usage?.costUsd ?? null,
        toolCalls,
        answer: subAgentTrace?.answer ?? call.result ?? "",
      };
    });

  // search_audit_standards returns its raw top-k with no relevance floor
  // (unlike ask_audit_assistant, which is guardrail-gated before it ever
  // generates), so a multi-tool-call trace can surface a couple dozen
  // citations, most well below the corpus's own MIN_RETRIEVAL_SCORE. Filter
  // to what the RAG assistant itself would consider relevant, then cap the
  // list so the UI's Sources panel stays a highlight reel, not a dump.
  // Citations without a score come from ask_audit_assistant, whose answer
  // was already guardrail-gated on topScore before generation -- keep them.
  // Rank scored (search_audit_standards) citations above unscored ones
  // (ask_audit_assistant's sources) rather than sorting them together --
  // unscored entries have no real relevance number to sort on, and a naive
  // "treat missing score as 1.0" would let them crowd out the
  // highest-scored real matches once the cap kicks in.
  const CITATION_CAP = 12;
  const allCitations = [...citationMap.values()];
  const scored = allCitations
    .filter((c) => c.score !== undefined && c.score >= MIN_RETRIEVAL_SCORE)
    .sort((a, b) => b.score - a.score);
  const unscored = allCitations.filter((c) => c.score === undefined);
  const citations = [...scored, ...unscored].slice(0, CITATION_CAP);

  return { steps, citations };
}
