import { Cpu, FilePlus2, GitBranch, ListChecks, PenLine, Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { AiProviderStatus, DeliveryRunResult, OrchestratorPlan } from "../types/commandCenter";
import { StatusPill } from "./StatusPill";

export function JiraWindow() {
  const [requirement, setRequirement] = useState(
    "Build enterprise lead assignment automation."
  );
  const [result, setResult] = useState<DeliveryRunResult | null>(null);
  const [provider, setProvider] = useState<AiProviderStatus | null>(null);
  const [plan, setPlan] = useState<OrchestratorPlan | null>(null);
  const [running, setRunning] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .aiProvider()
      .then(setProvider)
      .catch(() => undefined);
  }, []);

  async function planAgents() {
    setPlanning(true);
    setError(null);

    try {
      setPlan(await api.planOrchestration(requirement));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent planning failed");
    } finally {
      setPlanning(false);
    }
  }

  async function runDelivery() {
    setRunning(true);
    setError(null);

    try {
      if (!plan) {
        setPlan(await api.planOrchestration(requirement));
      }
      setResult(await api.runDelivery(requirement));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delivery run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="window-surface split-window">
      <div className="editor-pane">
        <p className="eyebrow">New Salesforce Requirement</p>
        <h2>Requirement Flow</h2>
        <div className="model-strip">
          <Cpu size={17} />
          <span>{provider?.model ?? "glm-5.1"}</span>
          <StatusPill
            label={provider?.configured ? "Configured" : "Needs API key"}
            tone={provider?.configured ? "good" : "warn"}
          />
        </div>
        <textarea
          value={requirement}
          onChange={(event) => setRequirement(event.target.value)}
          aria-label="Requirement"
        />
        <div className="action-row">
          <button>
            <FilePlus2 size={17} />
            Generate Stories
          </button>
          <button>
            <PenLine size={17} />
            Create Design
          </button>
          <button>
            <GitBranch size={17} />
            Create Jira
          </button>
          <button onClick={planAgents} disabled={planning}>
            <Cpu size={17} />
            {planning ? "Planning" : "Plan Agents"}
          </button>
          <button className="primary-action" onClick={runDelivery} disabled={running}>
            <Rocket size={17} />
            {running ? "Running" : "Run Full AI Delivery"}
          </button>
        </div>
        {error && <div className="inline-error">{error}</div>}
      </div>

      <div className="timeline-pane">
        <h3>Orchestrated Delivery</h3>
        {plan && (
          <div className="model-summary">
            <StatusPill label={plan.status} tone={plan.status === "FAILED" ? "danger" : "neutral"} />
            <span>{plan.summary}</span>
          </div>
        )}
        {(result?.steps ?? plan?.steps.map((step) =>
          `${step.agent}: ${step.action}${step.approvalRequired ? " (approval gate)" : ""}`
        ) ?? [
          "BA Agent ready",
          "Architect Agent ready",
          "Jira Agent ready",
          "Codex Agent ready",
          "Salesforce Agent ready",
          "Harness Engineer ready",
          "PR Agent ready"
        ]).map((step) => (
          <div className="timeline-item" key={step}>
            <ListChecks size={16} />
            <span>{step}</span>
          </div>
        ))}
        {result && <p className="result-summary">{result.summary}</p>}
      </div>
    </section>
  );
}
