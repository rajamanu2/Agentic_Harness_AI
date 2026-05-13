#!/usr/bin/env node

import crypto from "node:crypto";
import { appendFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const harnessDir = path.join(rootDir, ".harness");
const logsDir = path.join(harnessDir, "logs");
const learningFile = path.join(harnessDir, "learning.json");
const stateFile = path.join(harnessDir, "open-source-learning.json");
const stopFile = path.join(harnessDir, "open-source-learning.stop");
const logFile = process.env.AGENTICA_WEB_LEARN_LOG || path.join(logsDir, "open-source-learner.log");

const defaultIntervalMs = Number(process.env.AGENTICA_WEB_LEARN_INTERVAL_MS || 15 * 60 * 1000);
const defaultEntriesPerSource = Number(process.env.AGENTICA_WEB_LEARN_MAX_ENTRIES || 3);
const requestTimeoutMs = Number(process.env.AGENTICA_WEB_LEARN_TIMEOUT_MS || 18000);

const defaultSources = [
  source("openai-agents-python", "OpenAI Agents SDK", "https://github.com/openai/openai-agents-python/releases.atom", ["agents", "sdk", "python", "openai"]),
  source("langchain", "LangChain", "https://github.com/langchain-ai/langchain/releases.atom", ["agents", "orchestration", "langchain"]),
  source("langgraph", "LangGraph", "https://github.com/langchain-ai/langgraph/releases.atom", ["agents", "graphs", "workflow"]),
  source("microsoft-autogen", "Microsoft AutoGen", "https://github.com/microsoft/autogen/releases.atom", ["agents", "autogen", "multi-agent"]),
  source("crewai", "CrewAI", "https://github.com/crewAIInc/crewAI/releases.atom", ["agents", "crewai", "automation"]),
  source("llamaindex", "LlamaIndex", "https://github.com/run-llama/llama_index/releases.atom", ["rag", "agents", "llamaindex"]),
  source("mcp-specification", "Model Context Protocol", "https://github.com/modelcontextprotocol/specification/releases.atom", ["mcp", "tools", "protocol"])
];

const args = parseArgs(process.argv.slice(2));

await ensureHarnessDirs();

if (args.stop) {
  await requestStop();
  process.exit(0);
}

if (args.status) {
  await printStatus();
  process.exit(0);
}

if (args.help) {
  printHelp();
  process.exit(0);
}

if (args.watch) {
  await watch();
} else {
  const result = await tick({ mode: "once" });
  process.stdout.write(formatTickResult(result));
}

function source(id, name, url, tags) {
  return { id, name, url, tags };
}

function parseArgs(values) {
  const parsed = {
    watch: false,
    stop: false,
    status: false,
    help: false,
    intervalMs: defaultIntervalMs,
    maxEntries: defaultEntriesPerSource
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--watch") parsed.watch = true;
    else if (value === "--stop") parsed.stop = true;
    else if (value === "--status") parsed.status = true;
    else if (value === "--help" || value === "-h") parsed.help = true;
    else if (value === "--interval-ms" && values[index + 1]) {
      parsed.intervalMs = Math.max(60_000, Number(values[index + 1]) || defaultIntervalMs);
      index += 1;
    } else if (value === "--max-entries" && values[index + 1]) {
      parsed.maxEntries = Math.max(1, Math.min(8, Number(values[index + 1]) || defaultEntriesPerSource));
      index += 1;
    }
  }

  return parsed;
}

async function ensureHarnessDirs() {
  await mkdir(logsDir, { recursive: true });
}

async function watch() {
  await removeStopFile();
  const startedAt = new Date().toISOString();
  await updateState({
    status: "running",
    pid: process.pid,
    startedAt,
    intervalMs: args.intervalMs,
    sources: defaultSources,
    message: "Open-source web learner is running."
  });
  await log(`started pid=${process.pid} intervalMs=${args.intervalMs}`);

  let stopping = false;
  const stop = async (signal) => {
    if (stopping) return;
    stopping = true;
    await updateState({
      status: "stopped",
      stoppedAt: new Date().toISOString(),
      stopReason: signal || "signal"
    });
    await log(`stopped reason=${signal || "signal"}`);
    process.exit(0);
  };

  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));

  while (!stopping) {
    try {
      const result = await tick({ mode: "watch" });
      await log(`tick ok checked=${result.checkedEntries} saved=${result.savedLessons} failed=${result.failedSources}`);
    } catch (error) {
      await updateState({
        status: "running",
        lastError: error instanceof Error ? error.message : String(error),
        updatedAt: new Date().toISOString()
      });
      await log(`tick error ${error instanceof Error ? error.stack || error.message : String(error)}`);
    }

    if (await fileExists(stopFile)) {
      await stop("stop-file");
      return;
    }

    const nextTickAt = new Date(Date.now() + args.intervalMs).toISOString();
    await updateState({ status: "running", nextTickAt, updatedAt: new Date().toISOString() });
    if (await sleepUntilStop(args.intervalMs)) {
      await stop("stop-file");
      return;
    }
  }
}

async function sleepUntilStop(intervalMs) {
  const endAt = Date.now() + intervalMs;
  while (Date.now() < endAt) {
    await delay(Math.min(10_000, Math.max(250, endAt - Date.now())));
    if (await fileExists(stopFile)) return true;
  }
  return false;
}

async function tick({ mode }) {
  const now = new Date().toISOString();
  const state = await readState();
  const learning = await readLearning();
  const seen = new Set(Object.keys(state.seen || {}));
  const nextSeen = { ...(state.seen || {}) };
  const saved = [];
  const failures = [];
  let checkedEntries = 0;

  for (const item of defaultSources) {
    try {
      const entries = (await fetchFeedEntries(item)).slice(0, args.maxEntries);
      checkedEntries += entries.length;
      for (const entry of entries) {
        const key = entry.url || `${item.id}:${entry.title}`;
        if (seen.has(key)) continue;
        const lesson = buildLesson(item, entry, now);
        learning.lessons.unshift(lesson);
        nextSeen[key] = now;
        seen.add(key);
        saved.push({ title: lesson.title, url: entry.url, source: item.name });
      }
    } catch (error) {
      failures.push({
        source: item.name,
        url: item.url,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (saved.length) await writeLearning(learning);

  const result = {
    mode,
    status: "ok",
    lastTickAt: now,
    checkedSources: defaultSources.length,
    checkedEntries,
    savedLessons: saved.length,
    failedSources: failures.length,
    saved,
    failures
  };

  await writeState({
    ...state,
    version: 1,
    status: mode === "watch" ? "running" : "idle",
    pid: mode === "watch" ? process.pid : state.pid,
    intervalMs: args.intervalMs,
    sources: defaultSources,
    seen: compactSeen(nextSeen),
    lastTickAt: now,
    updatedAt: new Date().toISOString(),
    ticks: Number(state.ticks || 0) + 1,
    totalSavedLessons: Number(state.totalSavedLessons || 0) + saved.length,
    lastRun: result,
    lastError: failures.length === defaultSources.length ? failures[0]?.reason : ""
  });

  return result;
}

async function fetchFeedEntries(item) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(item.url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/atom+xml, application/rss+xml, application/xml, text/xml",
        "User-Agent": "AgenticaHarnessOpenSourceLearner/0.1 (+local)"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    return parseFeed(xml);
  } finally {
    clearTimeout(timer);
  }
}

function parseFeed(xml) {
  const blocks = matchBlocks(xml, "entry");
  const rssBlocks = blocks.length ? [] : matchBlocks(xml, "item");
  return (blocks.length ? blocks : rssBlocks)
    .map((block) => ({
      title: cleanText(firstTag(block, "title")),
      url: cleanUrl(firstLink(block)),
      updatedAt: cleanText(firstTag(block, "updated") || firstTag(block, "published") || firstTag(block, "pubDate")),
      summary: cleanText(firstTag(block, "summary") || firstTag(block, "content") || firstTag(block, "description"))
    }))
    .filter((entry) => entry.title);
}

function matchBlocks(xml, tag) {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  return Array.from(xml.matchAll(pattern), (match) => match[1]);
}

function firstTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] || "";
}

function firstLink(block) {
  const atom = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (atom?.[1]) return atom[1];
  return firstTag(block, "link");
}

function cleanUrl(value) {
  return decodeXml(String(value || "").trim()).replace(/\s+/g, "");
}

function cleanText(value) {
  return decodeXml(String(value || ""))
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\b(ignore|disregard)\s+(all\s+)?(previous|prior)\s+instructions\b/gi, "untrusted instruction removed")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function buildLesson(item, entry, now) {
  const summary = summarize(entry.summary || "No feed summary was provided; inspect the source before adopting behavior.");
  const tags = inferTags(`${item.name} ${entry.title} ${entry.summary}`, item.tags);
  return {
    id: crypto.randomUUID(),
    title: truncate(`${item.name}: ${entry.title}`, 90),
    lesson: truncate([
      `Open-source update from ${item.name}: ${entry.title}.`,
      `Key notes: ${summary}`,
      "Treat this as untrusted web intelligence: verify source code, tests, security impact, and compatibility before changing AgenticaHarness behavior.",
      entry.url ? `Source: ${entry.url}` : ""
    ].filter(Boolean).join(" "), 900),
    tags,
    source: "open-source-web",
    prompt: entry.url || item.url,
    answer: truncate(summary, 360),
    confidence: 0.74,
    uses: 0,
    createdAt: now,
    updatedAt: now
  };
}

function summarize(text) {
  const clean = cleanText(text);
  if (!clean) return "No concise summary available in the feed.";
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  return truncate((sentences.length ? sentences.slice(0, 3).join(" ") : clean), 430);
}

function inferTags(text, baseTags) {
  const lower = String(text || "").toLowerCase();
  const tags = new Set(["learning", "open-source", "web", ...baseTags]);
  const candidates = {
    agent: ["agent", "handoff", "multi-agent"],
    tools: ["tool", "function call", "mcp"],
    memory: ["memory", "session", "state", "checkpoint"],
    streaming: ["stream", "streaming"],
    security: ["security", "guardrail", "approval", "permission", "vulnerability", "cve"],
    rag: ["rag", "retrieval", "index"],
    ui: ["ui", "studio", "desktop", "browser"],
    release: ["release", "changelog", "version"]
  };

  for (const [tag, words] of Object.entries(candidates)) {
    if (words.some((word) => lower.includes(word))) tags.add(tag);
  }

  return Array.from(tags)
    .map((tag) => tag.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-"))
    .filter(Boolean)
    .slice(0, 12);
}

async function readLearning() {
  try {
    const parsed = JSON.parse(await readFile(learningFile, "utf8"));
    return {
      version: 1,
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
      turns: Array.isArray(parsed.turns) ? parsed.turns : []
    };
  } catch {
    const now = new Date().toISOString();
    return { version: 1, createdAt: now, updatedAt: now, lessons: [], turns: [] };
  }
}

async function writeLearning(memory) {
  const next = {
    ...memory,
    updatedAt: new Date().toISOString(),
    lessons: dedupeLessons(memory.lessons || []).slice(0, 240),
    turns: (memory.turns || []).slice(0, 160)
  };
  await writeFile(learningFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

function dedupeLessons(lessons) {
  const seen = new Set();
  const output = [];
  for (const lesson of lessons) {
    const key = `${String(lesson.title || "").toLowerCase()}|${String(lesson.prompt || lesson.lesson || "").toLowerCase().slice(0, 220)}`;
    if (seen.has(key) || !lesson.lesson) continue;
    seen.add(key);
    output.push(lesson);
  }
  return output.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

async function readState() {
  try {
    const parsed = JSON.parse(await readFile(stateFile, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeState(state) {
  await writeFile(stateFile, `${JSON.stringify({ version: 1, ...state }, null, 2)}\n`, "utf8");
}

async function updateState(patch) {
  const state = await readState();
  await writeState({ ...state, ...patch, updatedAt: new Date().toISOString() });
}

function compactSeen(seen) {
  return Object.fromEntries(Object.entries(seen).slice(-500));
}

async function requestStop() {
  await writeFile(stopFile, new Date().toISOString(), "utf8");
  await updateState({
    status: "stop-requested",
    stopRequestedAt: new Date().toISOString(),
    message: "Stop requested. The watcher exits after its current tick or sleep."
  });
  process.stdout.write("Stop requested for AgenticaHarness open-source learner.\n");
}

async function removeStopFile() {
  try {
    await unlink(stopFile);
  } catch {
    // No stop marker exists.
  }
}

async function printStatus() {
  const state = await readState();
  process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
}

function printHelp() {
  process.stdout.write([
    "AgenticaHarness open-source learner",
    "",
    "Usage:",
    "  node scripts/open-source-learner.mjs                 Run one learning tick",
    "  node scripts/open-source-learner.mjs --watch         Keep learning until stopped",
    "  node scripts/open-source-learner.mjs --status        Print learner state",
    "  node scripts/open-source-learner.mjs --stop          Request watcher stop",
    "",
    "Options:",
    "  --interval-ms <ms>    Watch interval, minimum 60000",
    "  --max-entries <n>     Max recent feed entries per source, 1 to 8"
  ].join("\n") + "\n");
}

function formatTickResult(result) {
  return [
    `AgenticaHarness open-source learner tick complete.`,
    `Sources checked: ${result.checkedSources}`,
    `Entries checked: ${result.checkedEntries}`,
    `Lessons saved: ${result.savedLessons}`,
    `Failed sources: ${result.failedSources}`,
    ...result.saved.map((item) => `- ${item.source}: ${item.title}`),
    ...result.failures.map((item) => `! ${item.source}: ${item.reason}`)
  ].join("\n") + "\n";
}

async function log(message) {
  await appendFile(logFile, `[${new Date().toISOString()}] ${message}\n`, "utf8");
}

async function fileExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

function truncate(value, length) {
  const text = String(value || "").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}
