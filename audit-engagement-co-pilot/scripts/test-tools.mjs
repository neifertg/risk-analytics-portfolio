// Phase 1 acceptance script: connects a real MCP Client to a real MCP
// Server over InMemoryTransport.createLinkedPair() (no subprocess, no
// network hop -- see Seth_Wiki/projects/audit-engagement-co-pilot.md for
// why), calls every tool with valid input, and induces one real failure
// per tool. Not a framework-based test runner -- a small standalone script,
// matching audit-rag-assistant/scripts/eval.mjs's own hand-rolled pattern.
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./mcp-server.mjs";
import { readStaticJson } from "./tools.mjs";

let pass = 0;
let fail = 0;

function report(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " -- " + detail : ""}`);
  if (ok) pass++;
  else fail++;
}

function textOf(result) {
  return result.content?.[0]?.text ?? "";
}

async function main() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-harness", version: "0.1.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const { tools } = await client.listTools();
  report(
    "MCP server lists all 7 tools",
    tools.length === 7,
    `got ${tools.length}: ${tools.map((t) => t.name).join(", ")}`
  );

  // --- happy-path calls: real data through the real wire ---

  const benfords = await client.callTool({ name: "get_benfords_analysis", arguments: {} });
  report(
    "get_benfords_analysis returns real data",
    !benfords.isError && JSON.parse(textOf(benfords)).nigrini_conformity === "Close conformity"
  );

  const dup = await client.callTool({ name: "check_duplicate_payments", arguments: {} });
  report(
    "check_duplicate_payments returns real data",
    !dup.isError && JSON.parse(textOf(dup)).total_flags === 52
  );

  const fraud = await client.callTool({ name: "get_fraud_ml_comparison", arguments: {} });
  report(
    "get_fraud_ml_comparison returns real data",
    !fraud.isError && JSON.parse(textOf(fraud)).comparison.rule_based.precision === 1.0
  );

  const search = await client.callTool({
    name: "search_audit_standards",
    arguments: { query: "SOX walkthrough testing" },
  });
  const searchResults = search.isError ? null : JSON.parse(textOf(search));
  report(
    "search_audit_standards returns scored excerpts",
    !search.isError && Array.isArray(searchResults) && searchResults.length > 0,
    search.isError ? textOf(search) : `${searchResults?.length} results`
  );

  const planAttr = await client.callTool({
    name: "plan_audit_sample",
    arguments: { method: "attribute", confidence_level: 0.95, population_size: 5000, tolerable_rate: 0.05, expected_rate: 0.01 },
  });
  const planAttrResult = planAttr.isError ? null : JSON.parse(textOf(planAttr));
  report(
    "plan_audit_sample (attribute) returns a real sample size",
    !planAttr.isError && planAttrResult.sample_size > 0,
    planAttr.isError ? textOf(planAttr) : `sample_size=${planAttrResult?.sample_size}`
  );

  const evalAttr = await client.callTool({
    name: "evaluate_audit_sample",
    arguments: {
      method: "attribute",
      confidence_level: 0.95,
      sample_size: planAttrResult?.sample_size ?? 95,
      deviations_found: 1,
      tolerable_rate: 0.05,
    },
  });
  report(
    "evaluate_audit_sample (attribute) returns a conclusion",
    !evalAttr.isError && !!JSON.parse(textOf(evalAttr)).conclusion
  );

  // Real Anthropic + Voyage API calls -- small real spend, same pattern as
  // audit-rag-assistant's own eval suite.
  const ask = await client.callTool({
    name: "ask_audit_assistant",
    arguments: { question: "What is tested in a SOX walkthrough?" },
  });
  const askResult = ask.isError ? null : JSON.parse(textOf(ask));
  report(
    "ask_audit_assistant returns a grounded, cited answer",
    !ask.isError && askResult.answer.length > 0 && !askResult.guardrailTriggered,
    ask.isError ? textOf(ask) : `cost ~$${askResult?.usage.estimatedCostUsd.toFixed(5)}`
  );

  // --- induced-failure calls, one per tool ---

  const badCorpus = await client.callTool({
    name: "search_audit_standards",
    arguments: { query: "test", corpus: "nonexistent" },
  });
  report("search_audit_standards rejects an invalid corpus value without crashing", badCorpus.isError === true);

  const badCorpusAsk = await client.callTool({
    name: "ask_audit_assistant",
    arguments: { question: "test", corpus: "nonexistent" },
  });
  report("ask_audit_assistant rejects an invalid corpus value without crashing", badCorpusAsk.isError === true);

  // Real business-logic error already in sampling.py: expected misstatement
  // must be less than tolerable misstatement.
  const badMus = await client.callTool({
    name: "plan_audit_sample",
    arguments: {
      method: "mus",
      confidence_level: 0.95,
      population_value: 1_000_000,
      tolerable_misstatement: 10000,
      expected_misstatement: 20000,
    },
  });
  report(
    "plan_audit_sample (mus) surfaces a real business-logic error as isError, not a crash",
    badMus.isError === true,
    textOf(badMus)
  );

  const badEval = await client.callTool({
    name: "evaluate_audit_sample",
    arguments: { method: "mus", confidence_level: 0.95 },
  });
  report(
    "evaluate_audit_sample (mus) surfaces a missing-field error as isError, not a crash",
    badEval.isError === true,
    textOf(badEval)
  );

  // The 3 static-read tools' induced failure lives at the file-read layer,
  // not the tool-argument layer (they take no arguments) -- tested directly
  // against readStaticJson rather than through the wire. See tools.mjs's
  // comment on this design choice.
  try {
    readStaticJson(path.join("does", "not", "exist.json"), "induced-failure test");
    report("readStaticJson throws a clear error on a missing file", false, "did not throw");
  } catch (err) {
    report("readStaticJson throws a clear error on a missing file", err.message.includes("file not found"), err.message);
  }

  await client.close();
  await server.close();

  console.log(`\n${pass}/${pass + fail} passed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("test-tools: fatal error:", err);
  process.exit(1);
});
