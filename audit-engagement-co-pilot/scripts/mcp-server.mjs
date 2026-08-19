import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { allTools } from "./tools.mjs";

export function createServer() {
  const server = new McpServer({ name: "audit-engagement-co-pilot", version: "0.1.0" });
  for (const tool of allTools) {
    server.registerTool(tool.name, tool.config, tool.handler);
  }
  return server;
}
