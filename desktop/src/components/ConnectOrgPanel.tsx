import { CheckCircle2, Clipboard, Globe2, RefreshCw, TerminalSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type { OrgStatus } from "../types/commandCenter";
import { StatusPill } from "./StatusPill";

type ConnectOrgPanelProps = {
  onOpenBrowser: (url: string) => void;
};

function statusTone(status?: string) {
  if (status === "CONNECTED") return "good";
  if (status === "CHECK_FAILED") return "danger";
  return "warn";
}

function statusLabel(status?: string) {
  if (status === "CONNECTED") return "Connected";
  if (status === "NOT_CONNECTED") return "Not connected";
  if (status === "NOT_READY") return "Setup needed";
  if (status === "CHECK_FAILED") return "Check failed";
  return "Checking";
}

function friendlyMessage(status: OrgStatus | null, loginCommand: string) {
  if (!status) {
    return "Checking your Salesforce CLI connection.";
  }

  if (status.status === "CONNECTED") {
    return status.username
      ? `Connected as ${status.username}.`
      : "Salesforce org is connected.";
  }

  if (status.status === "NOT_CONNECTED") {
    return `No login was found for ${status.orgAlias}. Run ${loginCommand}, then click Check Connection.`;
  }

  if (status.status === "NOT_READY") {
    return "Salesforce CLI is not ready on this machine. Install it first, then use the login command below.";
  }

  if (status.status === "CHECK_FAILED") {
    return "The connection check failed. The full Salesforce CLI output was saved in Logs.";
  }

  return status.message || "Run the login command below, then check again.";
}

export function ConnectOrgPanel({ onOpenBrowser }: ConnectOrgPanelProps) {
  const [status, setStatus] = useState<OrgStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [loginUrl, setLoginUrl] = useState("https://test.salesforce.com");

  const orgAlias = status?.orgAlias || "dev-sandbox";
  const loginCommand = useMemo(
    () => `sf org login web --alias ${orgAlias} --instance-url ${normalizeLoginUrl(loginUrl)}`,
    [orgAlias, loginUrl]
  );
  const isConnected = status?.status === "CONNECTED";

  async function checkConnection() {
    setLoading(true);

    try {
      setStatus(await api.orgStatus());
    } catch (error) {
      setStatus({
        orgAlias,
        status: "CHECK_FAILED",
        username: "",
        instanceUrl: "",
        message: "Could not check Salesforce connection.",
        source: "desktop"
      });
    } finally {
      setLoading(false);
    }
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(loginCommand);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy"), 1400);
    } catch {
      setCopyLabel("Copy failed");
      window.setTimeout(() => setCopyLabel("Copy"), 1800);
    }
  }

  useEffect(() => {
    api
      .orgLoginCommand()
      .then((nextCommand) => setLoginUrl(nextCommand.loginUrl))
      .catch(() => undefined);
    checkConnection();
  }, []);

  return (
    <section className="connect-panel">
      <div className="connect-copy">
        <p className="eyebrow">Salesforce Connection</p>
        <h2>{isConnected ? "Org connected" : "Connect sandbox"}</h2>
        <p>{friendlyMessage(status, loginCommand)}</p>
      </div>

      <div className="connect-steps">
        <StatusPill label={statusLabel(status?.status)} tone={statusTone(status?.status)} />
        <div className="command-copy">
          <TerminalSquare size={17} />
          <code>{loginCommand}</code>
          <button onClick={copyCommand}>
            <Clipboard size={16} />
            {copyLabel}
          </button>
        </div>
        <label className="compact-field">
          Salesforce login URL or My Domain
          <input
            value={loginUrl}
            onChange={(event) => setLoginUrl(event.target.value)}
            placeholder="https://test.salesforce.com or https://mydomain.my.salesforce.com"
          />
        </label>
        {isConnected && status?.instanceUrl && <p className="helper-text">{status.instanceUrl}</p>}
        <div className="connect-actions">
          <button onClick={() => onOpenBrowser(status?.instanceUrl || "https://login.salesforce.com")}>
            <Globe2 size={17} />
            Open Salesforce in App
          </button>
          <button onClick={checkConnection} disabled={loading}>
            {isConnected ? <CheckCircle2 size={17} /> : <RefreshCw size={17} />}
            {loading ? "Checking" : "Check Connection"}
          </button>
        </div>
      </div>
    </section>
  );
}

function normalizeLoginUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "https://test.salesforce.com";
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
