// Phase 2: the tool-use loop primitive. New code alongside (not replacing)
// audit-rag-assistant/scripts/answer.mjs's callAnthropic, which is
// single-turn and takes no `tools` param. This is deliberately hand-rolled,
// not a framework loop -- see Seth_Wiki/projects/audit-engagement-co-pilot.md
// for the "what a framework would give me for free" tradeoff this accepts:
// no automatic retry/backoff on transport errors, a fixed max-turn cap
// rather than adaptive budgeting.
//
// Backend-agnostic on purpose: takes a `callTool(name, input)` function
// rather than an MCP Client directly, so it isn't coupled to MCP -- the
// bridge to a real MCP Client lives in mcp-bridge.mjs.
import { loadSecret } from "../../audit-rag-assistant/scripts/secrets.mjs";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
export const DEFAULT_MAX_TURNS = 6;

// Runs the Anthropic tool-use loop to completion (or until maxTurns is hit).
// `callTool(name, input)` should resolve to the tool's result text, or throw
// -- a thrown error is caught here and turned into a `tool_result` with
// `is_error: true`, matching Phase 1's "well-formed error, not a crash"
// discipline one level up the stack.
export async function callAnthropicWithTools({
  model,
  system,
  messages,
  tools,
  callTool,
  maxTokens = 1024,
  maxTurns = DEFAULT_MAX_TURNS,
}) {
  const apiKey = await loadSecret("anthropic.api_key");
  const convo = [...messages];
  const usage = { inputTokens: 0, outputTokens: 0 };
  const trace = [];

  for (let turn = 1; turn <= maxTurns; turn++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: convo, tools }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API request failed (${res.status}): ${body}`);
    }

    const json = await res.json();
    usage.inputTokens += json.usage.input_tokens;
    usage.outputTokens += json.usage.output_tokens;
    convo.push({ role: "assistant", content: json.content });

    const toolUses = json.content.filter((block) => block.type === "tool_use");
    if (json.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = json.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
      return { text, usage, trace, turns: turn, terminatedReason: "end_turn" };
    }

    // Parallel tool_use blocks in one turn are executed concurrently, then
    // every tool_result is returned together in the next user message --
    // matches how Claude actually issues them, rather than serializing.
    const toolResults = await Promise.all(
      toolUses.map(async (block) => {
        let resultText;
        let isError = false;
        try {
          resultText = await callTool(block.name, block.input);
        } catch (err) {
          resultText = err.message;
          isError = true;
        }
        trace.push({ turn, tool: block.name, input: block.input, isError, result: resultText });
        return {
          type: "tool_result",
          tool_use_id: block.id,
          content: [{ type: "text", text: typeof resultText === "string" ? resultText : JSON.stringify(resultText) }],
          is_error: isError,
        };
      })
    );

    convo.push({ role: "user", content: toolResults });
  }

  return {
    text: "(agent stopped: reached the max tool-use turn cap without a final answer)",
    usage,
    trace,
    turns: maxTurns,
    terminatedReason: "max_turns",
  };
}
