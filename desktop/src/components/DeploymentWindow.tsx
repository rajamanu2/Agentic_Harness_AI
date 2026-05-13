import { GitPullRequest, Play, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api } from "../services/api";
import type { DeploymentValidation } from "../types/commandCenter";
import { StatusPill } from "./StatusPill";

export function DeploymentWindow() {
  const [result, setResult] = useState<DeploymentValidation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function validate() {
    setLoading(true);
    setError(null);

    try {
      setResult(await api.validateDeployment());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="window-surface split-window">
      <div className="editor-pane">
        <p className="eyebrow">Deployment / PR</p>
        <h2>Sandbox Validation</h2>
        <div className="approval-list">
          {[
            "Production deployment",
            "Destructive change",
            "Permission or profile update",
            "Sharing model update",
            "Integration credential update"
          ].map((approval) => (
            <div className="finding" key={approval}>
              <StatusPill label="Approval" tone="warn" />
              <span>{approval}</span>
            </div>
          ))}
        </div>
        <div className="action-row">
          <button className="primary-action" onClick={validate} disabled={loading}>
            <Play size={17} />
            {loading ? "Validating" : "Validate Sandbox"}
          </button>
          <button>
            <GitPullRequest size={17} />
            Create PR
          </button>
        </div>
        {error && <div className="inline-error">{error}</div>}
      </div>

      <div className="output-pane">
        <h3>
          <ShieldCheck size={18} />
          Validation Result
        </h3>
        {result ? (
          <>
            <StatusPill
              label={result.status}
              tone={result.status === "PASSED" ? "good" : "warn"}
            />
            <pre>{result.output}</pre>
          </>
        ) : (
          <pre>Run validation to see Salesforce CLI dry-run output.</pre>
        )}
      </div>
    </section>
  );
}
