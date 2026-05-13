import { Bot, FileCode2, Play, Wrench } from "lucide-react";
import { useState } from "react";
import { api } from "../services/api";
import type { CodexRunResult } from "../types/commandCenter";

export function CodexWindow() {
  const [repoPath, setRepoPath] = useState("../salesforce");
  const [prompt, setPrompt] = useState(
    "Create Apex and tests for enterprise lead assignment automation. Keep changes isolated and validate locally."
  );
  const [result, setResult] = useState<CodexRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runCodex() {
    setRunning(true);
    setError(null);

    try {
      setResult(await api.runCodex(repoPath, prompt));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Codex run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="window-surface split-window">
      <div className="editor-pane">
        <p className="eyebrow">Codex Task</p>
        <h2>Implementation Prompt</h2>
        <label>
          Repository Path
          <input value={repoPath} onChange={(event) => setRepoPath(event.target.value)} />
        </label>
        <label>
          Prompt
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            aria-label="Codex prompt"
          />
        </label>
        <div className="action-row">
          <button className="primary-action" onClick={runCodex} disabled={running}>
            <Play size={17} />
            {running ? "Running Codex" : "Run Codex"}
          </button>
          <button>
            <Wrench size={17} />
            Ask Codex to Fix
          </button>
        </div>
        {error && <div className="inline-error">{error}</div>}
      </div>

      <div className="output-pane">
        <h3>
          <Bot size={18} />
          Output
        </h3>
        <pre>{result?.output ?? "Codex output will appear here."}</pre>
        <h3>
          <FileCode2 size={18} />
          Changed Files
        </h3>
        <ul className="file-list">
          {(result?.changedFiles ?? ["No files changed yet"]).map((file) => (
            <li key={file}>{file}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
