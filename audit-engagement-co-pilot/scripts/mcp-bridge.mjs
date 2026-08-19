// Bridges a real MCP Client to the Anthropic tool-use format that
// agent-loop.mjs speaks -- kept separate from agent-loop.mjs so the loop
// primitive itself stays backend-agnostic (see that file's header comment).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./mcp-server.mjs";

// Same transport choice as Phase 1's test-tools.mjs and for the same
// reason: InMemoryTransport.createLinkedPair() gives a real Server/Client
// pair and real JSON-RPC-shaped messages with no subprocess or network hop.
export async function connectInProcessMcp() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "audit-engagement-co-pilot-agents", version: "0.1.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const { tools } = await client.listTools();
  return { client, server, mcpTools: tools };
}

// MCP's inputSchema is JSON Schema (draft-07, per the $schema it stamps on
// every tool) with fields Anthropic's input_schema doesn't expect --
// stripped rather than passed through blind.
export function mcpToolsToAnthropicTools(mcpTools) {
  return mcpTools.map(({ name, description, inputSchema }) => {
    const { $schema, ...schema } = inputSchema;
    return { name, description, input_schema: schema };
  });
}

// MCP's default per-call timeout (60s, DEFAULT_REQUEST_TIMEOUT_MSEC) is too
// short for ask_audit_assistant/search_audit_standards under real load: a
// real induced bug (found live via Phase 4's multi-agent evals) was
// embed.mjs racing concurrent Voyage calls past its own throttle -- fixing
// that race by serializing embed calls (see embed.mjs) means a second
// concurrent tool call now legitimately waits behind the first one's full
// embed-throttle-plus-retry duration, which can exceed 60s on its own. This
// is an in-process call with no real network hop, so a generous timeout
// costs nothing when things are healthy and just gives real slow paths
// room to finish instead of erroring out from under them.
const MCP_CALL_TIMEOUT_MS = 5 * 60 * 1000;

// Adapts client.callTool()'s { content, isError } shape into agent-loop's
// callTool(name, input) -> text-or-throw contract.
export function makeMcpCallTool(client) {
  return async function callTool(name, input) {
    const result = await client.callTool({ name, arguments: input }, undefined, { timeout: MCP_CALL_TIMEOUT_MS });
    const text = result.content?.[0]?.text ?? "";
    if (result.isError) throw new Error(text || `${name} failed with no error detail`);
    return text;
  };
}
