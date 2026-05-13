import { RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { OrgChangesResponse, OrgStatus } from "../types/commandCenter";
import { ConnectOrgPanel } from "./ConnectOrgPanel";
import { StatusPill } from "./StatusPill";

function riskTone(riskLevel: string) {
  if (riskLevel === "High") return "danger";
  if (riskLevel === "Medium") return "warn";
  return "good";
}

type OrgChangesWindowProps = {
  onOpenBrowser: (url: string) => void;
};

export function OrgChangesWindow({ onOpenBrowser }: OrgChangesWindowProps) {
  const [status, setStatus] = useState<OrgStatus | null>(null);
  const [changes, setChanges] = useState<OrgChangesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const [nextStatus, nextChanges] = await Promise.all([
        api.orgStatus(),
        api.orgChanges()
      ]);
      setStatus(nextStatus);
      setChanges(nextChanges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load org changes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="window-surface table-window">
      <div className="window-header">
        <div>
          <p className="eyebrow">Salesforce Org Changes</p>
          <h2>{status?.orgAlias ?? "dev-sandbox"}</h2>
        </div>
        <div className="header-actions">
          <StatusPill label={status?.status ?? "Loading"} tone="good" />
          <button onClick={refresh} disabled={loading}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </div>
      {status?.status !== "CONNECTED" && <ConnectOrgPanel onOpenBrowser={onOpenBrowser} />}
      {error && <div className="inline-error">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Section</th>
              <th>Action</th>
              <th>Display</th>
              <th>Risk</th>
              <th>AI Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {(changes?.changes ?? []).map((change) => (
              <tr key={change.id}>
                <td>{change.createdDate}</td>
                <td>{change.createdBy}</td>
                <td>{change.section}</td>
                <td>{change.action}</td>
                <td>{change.display}</td>
                <td>
                  <StatusPill label={change.riskLevel} tone={riskTone(change.riskLevel)} />
                </td>
                <td>{change.recommendation}</td>
              </tr>
            ))}
            {!changes?.changes.length && (
              <tr>
                <td colSpan={7} className="empty-cell">
                  <ShieldAlert size={18} />
                  No org changes loaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
