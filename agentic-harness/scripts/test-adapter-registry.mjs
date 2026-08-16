import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const fixtures = await mkdtemp(path.join(os.tmpdir(), "forgeos-adapters-"));
const port = 18997;
const server = spawn(process.execPath, ["server.mjs"], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: "pipe" });

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("ForgeOS test server did not start.");
}

async function fixture(name, files) {
  const directory = path.join(fixtures, name);
  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(directory, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents, "utf8");
  }
  return directory;
}

async function scan(repoPath) {
  const response = await fetch(`http://127.0.0.1:${port}/api/scan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repoPath }) });
  const text = await response.text();
  assert.equal(response.ok, true, text);
  return JSON.parse(text);
}

try {
  await waitForServer();
  const cases = [
    ["visual-web", { "package.json": JSON.stringify({ dependencies: { react: "latest", "react-dom": "latest", three: "latest", "framer-motion": "latest" } }), "src/App.tsx": "export default () => null" }, ["node", "react", "framer-motion", "threejs"]],
    ["vue", { "package.json": JSON.stringify({ dependencies: { vue: "latest", gsap: "latest" } }), "src/App.vue": "<template />" }, ["node", "vue", "web-animation"]],
    ["mern", { "package.json": JSON.stringify({ dependencies: { react: "latest", express: "latest", mongoose: "latest" } }) }, ["node", "react", "mern"]],
    ["automation-cloud", { "package.json": JSON.stringify({ dependencies: { n8n: "latest" } }), "template.yaml": "Resources: {}" }, ["node", "n8n", "aws"]],
    ["salesforce", { "sfdx-project.json": "{}", "force-app/main/default/classes/A.cls": "public class A {}" }, ["salesforce"]]
  ];
  for (const [name, files, expected] of cases) {
    const result = await scan(await fixture(name, files));
    const ids = result.stacks.map((stack) => stack.id);
    for (const id of expected) assert(ids.includes(id), `${name} did not detect ${id}: ${ids.join(", ")}`);
  }
  const custom = await fixture("custom", {
    "acme.build": "dynamic",
    ".forgeos/adapters.json": JSON.stringify({ adapters: [{ id: "acme", name: "Acme Runtime", files: ["acme.build"], test: ["acme verify"] }] })
  });
  assert((await scan(custom)).stacks.some((stack) => stack.id === "acme"), "workspace adapter was not loaded");
  const catalog = await (await fetch(`http://127.0.0.1:${port}/api/adapters`)).json();
  assert(catalog.adapters.length >= 23);
  console.log(`ForgeOS adapter tests passed: ${cases.length} multi-stack fixtures + 1 custom adapter; ${catalog.adapters.length} built-ins.`);
} finally {
  server.kill();
  await rm(fixtures, { recursive: true, force: true });
}
