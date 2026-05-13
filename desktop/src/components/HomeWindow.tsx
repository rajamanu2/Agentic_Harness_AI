import {
  ArrowRight,
  Globe2,
  ListChecks,
  Radar,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { ConnectOrgPanel } from "./ConnectOrgPanel";
import type { SystemHello, WindowName } from "../types/commandCenter";
import { StatusPill } from "./StatusPill";

type HomeWindowProps = {
  system: SystemHello | null;
  onOpen: (windowName: WindowName) => void;
  onOpenBrowser: (url: string) => void;
};

const statLabels = [
  { label: "Org Alias", key: "connectedOrg" },
  { label: "Active Branch", key: "activeBranch" },
  { label: "Last Org Scan", key: "lastOrgScan" },
  { label: "Pending PRs", key: "pendingPrs" },
  { label: "Critical Issues", key: "criticalIssues" }
] as const;

export function HomeWindow({ system, onOpen, onOpenBrowser }: HomeWindowProps) {
  const userName = system?.userName ?? "Manu";

  return (
    <section className="window-surface home-window">
      <div className="home-greeting">
        <div className="greeting-copy">
          <p className="eyebrow">Welcome back</p>
          <h1>Hi, {userName}</h1>
          <p>Build Salesforce work, check org health, or open your connected tools from one place.</p>
        </div>

        <div className="home-actions">
          <button className="primary-action" onClick={() => onOpen("JIRA")}>
            <Sparkles size={18} />
            New Requirement
          </button>
          <button onClick={() => onOpenBrowser("https://login.salesforce.com")}>
            <Globe2 size={18} />
            Open Salesforce
          </button>
          <button onClick={() => onOpen("ORG_SCAN")}>
            <Radar size={18} />
            Run Scan
          </button>
        </div>
      </div>

      <ConnectOrgPanel onOpenBrowser={onOpenBrowser} />

      <div className="status-grid">
        {statLabels.map((item) => (
          <article className="metric-card" key={item.key}>
            <span>{item.label}</span>
            <strong>{String(system?.[item.key] ?? "Loading")}</strong>
          </article>
        ))}
      </div>

      <div className="secondary-actions">
        <button onClick={() => onOpen("CODEX")}>
          <ListChecks size={18} />
          Open Codex
        </button>
        <button onClick={() => onOpen("ORG_CHANGES")}>
          <ShieldCheck size={18} />
          View Org Changes
        </button>
        <button onClick={() => onOpen("LOGS")}>
          <ArrowRight size={18} />
          View Logs
        </button>
      </div>

      <div className="workflow-strip">
        <StatusPill label="Human approval required for production" tone="warn" />
        <span>User requirement</span>
        <ArrowRight size={16} />
        <span>Stories</span>
        <ArrowRight size={16} />
        <span>Codex</span>
        <ArrowRight size={16} />
        <span>Sandbox validation</span>
        <ArrowRight size={16} />
        <span>PR</span>
      </div>
    </section>
  );
}
