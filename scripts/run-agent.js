#!/usr/bin/env node
/**
 * Einfacher manueller Test des AI-Agent-Service.
 *
 * Voraussetzungen:
 * - API laeuft: npm run dev (Port 3080)
 * - Worker laeuft: npm run dev:worker
 * - Postgres + Redis laufen (.env: DATABASE_URL, REDIS_URL)
 * - LLM konfiguriert (.env: LLM_PROVIDER, OPENAI_API_KEY oder OPENROUTER_API_KEY)
 *
 * Ablauf:
 * 1) POST /runs mit userText
 * 2) Polling bis Run completed/failed
 * 3) Ausgabe des Ergebnisses
 */

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3080";

async function fetchJson(method, path, body) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const userText = process.argv[2] || "Wie spaet ist es?";
  console.log("--- AI-Agent Test ---");
  console.log("Anfrage:", userText);
  console.log("");

  const run = await fetchJson("POST", "/runs", { userText });
  const runId = run?.id;
  if (!runId) {
    console.error("Kein Run erstellt. Response:", run);
    process.exit(1);
  }
  console.log("Run erstellt:", runId);
  console.log("Status:", run.status);
  console.log("");

  let current = run;
  const maxWait = 60_000;
  const pollInterval = 1500;
  const start = Date.now();

  while (current.status !== "completed" && current.status !== "failed") {
    if (Date.now() - start > maxWait) {
      console.error("Timeout: Run nicht abgeschlossen nach", maxWait / 1000, "Sekunden.");
      process.exit(1);
    }
    await sleep(pollInterval);
    current = await fetchJson("GET", `/runs/${runId}`);
    console.log("  ... Status:", current.status);
  }

  console.log("");
  console.log("=== Ergebnis ===");
  console.log("Status:", current.status);

  if (current.result) {
    console.log("Reply:", current.result.reply || "(leer)");
    if (current.result.action) console.log("Action:", current.result.action);
    if (current.result.suggestedTool) console.log("Suggested Tool:", current.result.suggestedTool);
    if (current.result.toolResults?.length) {
      console.log("Tool Results:", JSON.stringify(current.result.toolResults, null, 2));
    }
  }
  if (current.error) console.log("Error:", current.error);

  console.log("");
  process.exit(current.status === "completed" ? 0 : 1);
}

main().catch((err) => {
  console.error("Fehler:", err.message);
  process.exit(1);
});
