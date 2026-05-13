#!/usr/bin/env node

const args = process.argv.slice(2);
let repoPath = process.env.AGENTICA_REPO || ".";
const promptParts = [];

for (let index = 0; index < args.length; index += 1) {
  const value = args[index];
  if ((value === "--repo" || value === "--project") && args[index + 1]) {
    repoPath = args[index + 1];
    index += 1;
    continue;
  }
  promptParts.push(value);
}

const message = promptParts.join(" ").trim();
if (!message) {
  console.error("Usage: npm run agentica -- \"your prompt\" [-- --repo path]");
  process.exit(1);
}

const configuredUrl = process.env.AGENTICA_API_URL?.replace(/\/$/, "");
const portUrl = process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : "";
const candidates = [configuredUrl, portUrl, "http://127.0.0.1:8797", "http://127.0.0.1:8787"].filter(Boolean);
let lastError = null;

for (const baseUrl of [...new Set(candidates)]) {
  try {
    const response = await fetch(`${baseUrl}/api/agentica`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, repoPath })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Request failed with ${response.status}`);
    process.stdout.write(`${data.text || ""}\n`);
    process.exit(0);
  } catch (error) {
    lastError = error;
  }
}

console.error(`Agentica CLI could not reach the local Agentica API. ${lastError?.message || ""}`.trim());
console.error("Start it with: npm run start");
process.exit(1);
