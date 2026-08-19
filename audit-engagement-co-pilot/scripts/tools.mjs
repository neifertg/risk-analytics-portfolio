import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { z } from "zod";
import { retrieve } from "../../audit-rag-assistant/scripts/search.mjs";
import { answerQuestion } from "../../audit-rag-assistant/scripts/answer.mjs";
import {
  benfordsResultsPath,
  duplicatePaymentsFlaggedPath,
  fraudMlComparisonPath,
  samplingCalculatorDir,
  samplingCliPath,
  samplingCalculatorPython,
} from "./lib.mjs";

// --- static-read tools --------------------------------------------------
// These three tools read output already committed to the repo rather than
// re-running the underlying script live:
// - get_benfords_analysis's script hits a live SEC EDGAR API on every run
//   (multi-second, external dependency) -- re-running it per question would
//   add real latency/flakiness for identical output on a fixed historical
//   period.
// - get_fraud_ml_comparison's Isolation Forest/DBSCAN scoring functions
//   require ground-truth labels even for their "primary" run -- it's an
//   evaluation/comparison artifact, not a deployable blind detector.
// - check_duplicate_payments *could* technically be re-run live, but its
//   script has no per-query input variation (always reads the same
//   hardcoded ledger) and unconditionally overwrites its own output/chart
//   on every call -- re-running it would just race under concurrent
//   requests for identical output. Static read is honestly the same
//   capability with none of the cost.
// See Seth_Wiki/projects/audit-engagement-co-pilot.md for the full
// reasoning behind this line.
export function readStaticJson(filePath, label) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (err) {
    throw new Error(
      `${label}: could not read ${filePath} (${err.code === "ENOENT" ? "file not found" : err.message}).`
    );
  }
  return JSON.parse(raw);
}

const STATIC_CAVEAT =
  "Pre-computed on a seeded synthetic dataset as of the last portfolio update, not a live analysis of new data.";

export const searchAuditStandardsTool = {
  name: "search_audit_standards",
  config: {
    title: "Search Audit Standards",
    description:
      "Retrieve the most relevant audit-methodology/standards excerpts for a query, from the audit-rag-assistant corpus (COSO, IIA, SOX walkthroughs, etc.). Returns raw scored excerpts, not a generated answer -- use ask_audit_assistant for a cited, guardrail-protected answer instead.",
    inputSchema: {
      query: z.string().min(2).describe("Search query about audit methodology/standards"),
      corpus: z.enum(["generic", "tailored"]).optional().describe("Restrict to one corpus; omit to search both"),
    },
  },
  handler: async ({ query, corpus }) => {
    const { results } = await retrieve(query, { corpus });
    const summary = results.map(({ chunk, score }) => ({
      title: chunk.title,
      heading: chunk.heading,
      corpusSource: chunk.corpusSource,
      score: Number(score.toFixed(3)),
      excerpt: chunk.text.slice(0, 500),
    }));
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  },
};

export const askAuditAssistantTool = {
  name: "ask_audit_assistant",
  config: {
    title: "Ask Audit Assistant",
    description:
      "Ask a grounded question against the audit-methodology/standards corpus. Retrieval-guardrail protected: refuses to guess (returns guardrailTriggered: true) when nothing relevant is found, instead of generating from outside knowledge.",
    inputSchema: {
      question: z.string().min(2).describe("Question about audit methodology/standards"),
      corpus: z.enum(["generic", "tailored"]).optional().describe("Restrict to one corpus; omit to search both"),
    },
  },
  handler: async ({ question, corpus }) => {
    const result = await answerQuestion(question, { corpus });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

export const checkDuplicatePaymentsTool = {
  name: "check_duplicate_payments",
  config: {
    title: "Check Duplicate Payments",
    description: `Rule-based duplicate/split/near-duplicate vendor payment flags against this portfolio's seeded synthetic AP ledger (four named heuristics: exact duplicate, threshold-avoidance split, vendor-master duplicate, review candidate), scored against seeded ground truth (100% precision, 98.1% recall). ${STATIC_CAVEAT}`,
    inputSchema: {},
  },
  handler: async () => {
    const data = readStaticJson(duplicatePaymentsFlaggedPath, "check_duplicate_payments");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
};

export const getBenfordsAnalysisTool = {
  name: "get_benfords_analysis",
  config: {
    title: "Get Benford's Law Analysis",
    description: `Benford's Law conformity analysis (chi-square, Nigrini MAD) of real SEC EDGAR us-gaap:Assets values across ~6,400 filers for one period. ${STATIC_CAVEAT} A close-conformity result here is the expected, unsurprising baseline for a healthy market-wide aggregate -- not a fraud finding.`,
    inputSchema: {},
  },
  handler: async () => {
    const data = readStaticJson(benfordsResultsPath, "get_benfords_analysis");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
};

export const getFraudMlComparisonTool = {
  name: "get_fraud_ml_comparison",
  config: {
    title: "Get Fraud ML Comparison",
    description: `Isolation Forest / DBSCAN unsupervised anomaly detection results vs. the rule-based duplicate-payment checker, evaluated against the same seeded ground truth. ${STATIC_CAVEAT} This is an evaluation/comparison artifact (the ML methods require ground-truth labels even for their "primary" run) -- not a deployable blind detector for new, unlabeled data.`,
    inputSchema: {},
  },
  handler: async () => {
    const data = readStaticJson(fraudMlComparisonPath, "get_fraud_ml_comparison");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
};

// --- sampling tools (dynamic, via subprocess into sampling-calculator) --

function runSamplingCli(subcommand, payload) {
  return new Promise((resolve, reject) => {
    let python;
    try {
      python = samplingCalculatorPython();
    } catch (err) {
      reject(err);
      return;
    }
    const child = execFile(
      python,
      [samplingCliPath, subcommand],
      { cwd: samplingCalculatorDir },
      (err, stdout, stderr) => {
        let parsed;
        try {
          parsed = JSON.parse(stdout);
        } catch {
          reject(new Error(`sampling_cli.py (${subcommand}) produced non-JSON output: ${stdout || stderr}`));
          return;
        }
        if (parsed.error) {
          reject(new Error(`sampling_cli.py (${subcommand}): ${parsed.error}`));
          return;
        }
        if (err) {
          reject(new Error(`sampling_cli.py (${subcommand}) exited with an error: ${stderr || err.message}`));
          return;
        }
        resolve(parsed);
      }
    );
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

const PLAN_COMMAND_BY_METHOD = { attribute: "plan-attribute", mus: "plan-mus" };
const EVAL_COMMAND_BY_METHOD = { attribute: "evaluate-attribute", mus: "evaluate-mus" };

export const planAuditSampleTool = {
  name: "plan_audit_sample",
  config: {
    title: "Plan Audit Sample",
    description:
      "Compute a statistically-sound sample size for attribute sampling (tests of controls) or monetary-unit/PPS sampling (substantive testing), via this portfolio's sampling-calculator (AICPA reliability-factor methodology, verified against 10 real published table values).",
    inputSchema: {
      method: z.enum(["attribute", "mus"]),
      confidence_level: z.number().min(0).max(1),
      population_size: z.number().int().positive().optional().describe("Required for method=attribute"),
      tolerable_rate: z.number().min(0).max(1).optional().describe("Required for method=attribute"),
      expected_rate: z.number().min(0).max(1).optional().describe("Required for method=attribute"),
      population_value: z.number().positive().optional().describe("Required for method=mus"),
      tolerable_misstatement: z.number().positive().optional().describe("Required for method=mus"),
      expected_misstatement: z.number().min(0).optional().describe("Optional for method=mus, defaults to 0"),
    },
  },
  handler: async ({ method, ...params }) => {
    const result = await runSamplingCli(PLAN_COMMAND_BY_METHOD[method], params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

export const evaluateAuditSampleTool = {
  name: "evaluate_audit_sample",
  config: {
    title: "Evaluate Audit Sample",
    description:
      "Evaluate sample results for attribute sampling (computed upper deviation rate vs. tolerable rate) or monetary-unit/PPS sampling (projected misstatement, upper misstatement limit vs. tolerable misstatement), via this portfolio's sampling-calculator.",
    inputSchema: {
      method: z.enum(["attribute", "mus"]),
      confidence_level: z.number().min(0).max(1),
      sample_size: z.number().int().positive().optional().describe("Required for method=attribute"),
      deviations_found: z.number().int().min(0).optional().describe("Required for method=attribute"),
      tolerable_rate: z.number().min(0).max(1).optional().describe("Required for method=attribute"),
      sampling_interval: z.number().positive().optional().describe("Required for method=mus"),
      tolerable_misstatement: z.number().positive().optional().describe("Required for method=mus"),
      misstatements: z
        .array(z.object({ book_value: z.number(), audited_value: z.number() }))
        .optional()
        .describe("Required for method=mus; every misstated item found in the sample"),
    },
  },
  handler: async ({ method, ...params }) => {
    const result = await runSamplingCli(EVAL_COMMAND_BY_METHOD[method], params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};

export const allTools = [
  searchAuditStandardsTool,
  askAuditAssistantTool,
  checkDuplicatePaymentsTool,
  getBenfordsAnalysisTool,
  getFraudMlComparisonTool,
  planAuditSampleTool,
  evaluateAuditSampleTool,
];
