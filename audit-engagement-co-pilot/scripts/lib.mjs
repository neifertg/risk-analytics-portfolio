import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(scriptsDir, "..");
export const portfolioRoot = path.resolve(projectRoot, "..");

export const benfordsResultsPath = path.join(portfolioRoot, "benfords-law-analyzer", "output", "results.json");
export const duplicatePaymentsFlaggedPath = path.join(
  portfolioRoot,
  "duplicate-vendor-payment-checker",
  "output",
  "flagged.json"
);
export const fraudMlComparisonPath = path.join(
  portfolioRoot,
  "duplicate-payment-anomaly-detection",
  "output",
  "results.json"
);
export const samplingCalculatorDir = path.join(portfolioRoot, "sampling-calculator");
export const samplingCliPath = path.join(samplingCalculatorDir, "sampling_cli.py");

// sampling-calculator has its own .venv, per this repo's one-venv-per-
// Python-project convention (no shared root environment). Windows path
// locally; POSIX path once this runs inside the Phase 5 Linux container --
// try both rather than hardcoding one, so this doesn't need to change later.
export function samplingCalculatorPython() {
  const candidates = [
    path.join(samplingCalculatorDir, ".venv", "Scripts", "python.exe"),
    path.join(samplingCalculatorDir, ".venv", "bin", "python"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      `sampling-calculator's .venv not found at any of: ${candidates.join(", ")} -- run its own setup first.`
    );
  }
  return found;
}
