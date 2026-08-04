import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Env-var-first, unlike Seth_Wiki's file-only version — this project also
// needs to run on Streamlit Community Cloud, which has no access to a local
// ~/.claude/secrets.yaml. app.py forwards Streamlit's own secrets manager
// into the Node subprocess's environment as ANTHROPIC_API_KEY / VOYAGE_API_KEY,
// so the deployed path never touches the file at all. js-yaml is imported
// dynamically, only inside the file-fallback branch below, so a Cloud
// deployment (env vars always set) needs zero npm packages installed at
// query time — only `node` itself.
function envVarName(keyPath) {
  return keyPath.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
}

export async function loadSecret(keyPath) {
  const envVar = envVarName(keyPath);
  if (process.env[envVar]) return process.env[envVar];

  const file = path.join(os.homedir(), ".claude", "secrets.yaml");
  if (!fs.existsSync(file)) {
    throw new Error(`secrets.mjs: no ${envVar} env var and no secrets file at ${file}`);
  }

  const { default: yaml } = await import("js-yaml");
  const doc = yaml.load(fs.readFileSync(file, "utf8")) ?? {};
  const parts = keyPath.split(".");
  let value = doc;
  for (const part of parts) {
    value = value?.[part];
  }

  if (!value) {
    throw new Error(`secrets.mjs: "${keyPath}" is missing (checked ${envVar} env var and ${file})`);
  }
  return value;
}
