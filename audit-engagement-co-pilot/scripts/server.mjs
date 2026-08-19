// Phase 5: minimal deployment surface. Deliberately no Express -- the
// plan's "no-framework ethos" carries over from the RAG assistant's own
// hand-rolled retrieval, and a single POST /ask endpoint plus a GET /
// demo page doesn't need a router.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runSupervisor } from "./supervisor.mjs";

const PORT = process.env.PORT || 8080;
const MAX_BODY_BYTES = 10_000;

// Read once at startup, not per-request -- it's static and this process
// only ever serves the one file. Render's healthCheckPath is "/" (see
// ../../render.yaml) and only checks for a 200, so serving HTML here
// instead of the old {"status":"ok"} JSON doesn't break the health check.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_HTML = fs.readFileSync(path.join(__dirname, "public", "index.html"));

// A per-session cap doesn't have a natural equivalent without a session
// framework, so this uses per-IP instead -- same cheap-deterrent ethos as
// audit-rag-assistant/app/app.py's MAX_QUESTIONS_PER_SESSION (5 per
// session): not real abuse protection, just enough to keep a public demo's
// API spend bounded. Tracked in-memory, so it resets on every deploy/
// restart, same as the Streamlit app's per-session cap resets per browser
// session.
const MAX_REQUESTS_PER_IP = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ipRequestLog = new Map(); // ip -> timestamps within the current window

function clientIp(req) {
  // Render (like most PaaS) terminates TLS at a proxy in front of the
  // container -- req.socket.remoteAddress would be the proxy's address for
  // every request, silently defeating the per-IP cap. x-forwarded-for's
  // first entry is the original client.
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (ipRequestLog.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  ipRequestLog.set(ip, recent);
  return recent.length >= MAX_REQUESTS_PER_IP;
}

function recordRequest(ip) {
  const recent = ipRequestLog.get(ip) ?? [];
  recent.push(Date.now());
  ipRequestLog.set(ip, recent);
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(text) });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let tooLarge = false;
    req.on("data", (chunk) => {
      if (tooLarge) return;
      data += chunk;
      if (data.length > MAX_BODY_BYTES) {
        tooLarge = true;
        reject(new Error(`request body exceeds ${MAX_BODY_BYTES} bytes`));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!tooLarge) resolve(data);
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": DEMO_HTML.length });
    res.end(DEMO_HTML);
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { status: "ok", service: "audit-engagement-co-pilot" });
    return;
  }

  if (req.method !== "POST" || req.url !== "/ask") {
    sendJson(res, 404, { error: "not found -- POST /ask with a JSON body { \"question\": \"...\" }" });
    return;
  }

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    sendJson(res, 429, {
      error: `This demo caps questions at ${MAX_REQUESTS_PER_IP} per hour per visitor to keep it sustainable to run publicly. Try again later.`,
    });
    return;
  }

  let question;
  try {
    const raw = await readBody(req);
    ({ question } = JSON.parse(raw));
  } catch (err) {
    sendJson(res, 400, { error: `invalid request body: ${err.message}` });
    return;
  }

  if (typeof question !== "string" || question.trim().length < 2) {
    sendJson(res, 400, { error: '"question" must be a non-empty string' });
    return;
  }

  recordRequest(ip);

  try {
    const result = await runSupervisor(question.trim());
    sendJson(res, 200, {
      answer: result.answer,
      dispatched: result.dispatched,
      turns: result.turns,
      usage: result.usage,
    });
  } catch (err) {
    console.error("server: /ask failed:", err);
    sendJson(res, 500, { error: "internal error answering the question -- see server logs" });
  }
});

server.listen(PORT, () => {
  console.log(`audit-engagement-co-pilot listening on :${PORT}`);
});
