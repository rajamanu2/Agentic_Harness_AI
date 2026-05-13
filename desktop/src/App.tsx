import {
  Activity,
  Bot,
  Chrome,
  ClipboardList,
  GitPullRequest,
  Home,
  Send,
  ScrollText,
  ShieldCheck
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BrowserWindow } from "./components/BrowserWindow";
import { CodexWindow } from "./components/CodexWindow";
import { DeploymentWindow } from "./components/DeploymentWindow";
import { HomeWindow } from "./components/HomeWindow";
import { JiraWindow } from "./components/JiraWindow";
import { LogsWindow } from "./components/LogsWindow";
import { OrgChangesWindow } from "./components/OrgChangesWindow";
import { OrgScanWindow } from "./components/OrgScanWindow";
import { StatusPill } from "./components/StatusPill";
import { api } from "./services/api";
import type { SystemHello, WindowName } from "./types/commandCenter";

const navItems: Array<{
  name: WindowName;
  label: string;
  icon: typeof Home;
}> = [
  { name: "HOME", label: "Home", icon: Home },
  { name: "JIRA", label: "Jira", icon: ClipboardList },
  { name: "BROWSER", label: "Browser", icon: Chrome },
  { name: "CODEX", label: "Codex", icon: Bot },
  { name: "ORG_CHANGES", label: "Org Changes", icon: ShieldCheck },
  { name: "ORG_SCAN", label: "24/7 Org Scan", icon: Activity },
  { name: "LOGS", label: "Logs", icon: ScrollText },
  { name: "DEPLOYMENT", label: "Deployment", icon: GitPullRequest }
];

const initialWindowParam = new URLSearchParams(window.location.search).get("window");

function toWindowName(value: string | null): WindowName {
  return navItems.some((item) => item.name === value)
    ? (value as WindowName)
    : "HOME";
}

function resolveCommandTarget(command: string): WindowName | null {
  const normalized = command.toLowerCase();

  if (normalized.includes("home") || normalized.includes("dashboard")) return "HOME";
  if (normalized.includes("jira") || normalized.includes("story") || normalized.includes("requirement")) return "JIRA";
  if (normalized.includes("chrome") || normalized.includes("browser") || normalized.includes("setup")) return "BROWSER";
  if (normalized.includes("codex") || normalized.includes("code")) return "CODEX";
  if (normalized.includes("change") || normalized.includes("audit trail") || normalized.includes("metadata")) return "ORG_CHANGES";
  if (normalized.includes("scan") || normalized.includes("health") || normalized.includes("monitor")) return "ORG_SCAN";
  if (normalized.includes("log") || normalized.includes("audit")) return "LOGS";
  if (normalized.includes("deploy") || normalized.includes("deployment") || normalized.includes("pr")) return "DEPLOYMENT";

  return null;
}

function App() {
  const [activeWindow, setActiveWindow] = useState<WindowName>(
    toWindowName(initialWindowParam)
  );
  const [system, setSystem] = useState<SystemHello | null>(null);
  const [apiStatus, setApiStatus] = useState<"Online" | "Offline" | "Loading">(
    "Loading"
  );
  const [commandMessage, setCommandMessage] = useState(
    "Hi Manu, welcome. What do we need to build or monitor today?"
  );
  const [commandText, setCommandText] = useState("");
  const [showIntro, setShowIntro] = useState(true);
  const [browserUrl, setBrowserUrl] = useState("https://login.salesforce.com");

  useEffect(() => {
    api
      .hello()
      .then((nextSystem) => {
        setSystem(nextSystem);
        setApiStatus("Online");
      })
      .catch(() => {
        setApiStatus("Offline");
        setSystem({
          message: "Hi, Manu",
          app: "AI Salesforce Command Center",
          status: "offline",
          userName: "Manu",
          connectedOrg: "dev-sandbox",
          activeBranch: "ai/lead-routing",
          lastOrgScan: "Not connected",
          pendingPrs: 0,
          criticalIssues: 0
        });
      });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowIntro(false);
    }, 4400);

    return () => window.clearTimeout(timer);
  }, []);

  const activeLabel = useMemo(
    () => navItems.find((item) => item.name === activeWindow)?.label ?? "Home",
    [activeWindow]
  );

  useEffect(() => {
    document.title = `${activeLabel} - AI Salesforce Command Center`;
  }, [activeLabel]);

  function routeCommand(command: string) {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) {
      return;
    }

    const target = resolveCommandTarget(command);

    if (target) {
      setActiveWindow(target);
      const targetLabel = navItems.find((item) => item.name === target)?.label ?? target;
      setCommandMessage(`Opened ${targetLabel}, Manu.`);
      return;
    }

    setCommandMessage(
      `Command not mapped: "${trimmedCommand}". Try open Codex, show logs, run scan, or open Jira.`
    );
  }

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!commandText.trim()) {
      return;
    }

    routeCommand(commandText);
    setCommandText("");
  }

  function openBrowser(url: string) {
    setBrowserUrl(url);
    setActiveWindow("BROWSER");
    setCommandMessage("Opened the in-app browser, Manu.");
  }

  return (
    <div className="app-shell">
      {showIntro && (
        <div className="intro-sequence">
          <div className="space-stage">
            <div className="moon" />
            <div className="earth">
              <div className="earth-glow" />
            </div>
            <div className="flight-path" />
          </div>
          <div className="intro-copy">
            <span>MANU OS</span>
            <strong>Entering Salesforce Command Core</strong>
          </div>
        </div>
      )}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <span />
          </div>
          <div>
            <strong>MANU OS</strong>
            <span>Salesforce Command Core</span>
          </div>
        </div>

        <nav aria-label="Command Center windows">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeWindow === item.name ? "active" : ""}
                key={item.name}
                onClick={() => setActiveWindow(item.name)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="page-heading">
            <p className="eyebrow">AI Salesforce Command Center</p>
            <h1>{activeLabel}</h1>
            <span>{commandMessage}</span>
          </div>
          <div className="topbar-status">
            <form className="command-bar" onSubmit={submitCommand}>
              <input
                aria-label="Command"
                placeholder="Search or type: open Codex"
                value={commandText}
                onChange={(event) => setCommandText(event.target.value)}
              />
              <button aria-label="Run command" type="submit">
                <Send size={16} />
              </button>
            </form>
            <StatusPill
              label={`API ${apiStatus}`}
              tone={apiStatus === "Online" ? "good" : apiStatus === "Offline" ? "danger" : "neutral"}
            />
            <StatusPill label={system?.connectedOrg ?? "dev-sandbox"} tone="neutral" />
          </div>
        </header>

        {activeWindow === "HOME" && (
          <HomeWindow
            system={system}
            onOpen={setActiveWindow}
            onOpenBrowser={openBrowser}
          />
        )}
        {activeWindow === "JIRA" && <JiraWindow />}
        {activeWindow === "BROWSER" && <BrowserWindow initialUrl={browserUrl} />}
        {activeWindow === "CODEX" && <CodexWindow />}
        {activeWindow === "ORG_CHANGES" && <OrgChangesWindow onOpenBrowser={openBrowser} />}
        {activeWindow === "ORG_SCAN" && <OrgScanWindow />}
        {activeWindow === "LOGS" && <LogsWindow />}
        {activeWindow === "DEPLOYMENT" && <DeploymentWindow />}
      </main>
    </div>
  );
}

export default App;
