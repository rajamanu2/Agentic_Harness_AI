import { Activity, Play, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { OrgScanResult } from "../types/commandCenter";
import { StatusPill } from "./StatusPill";

export function OrgScanWindow() {
  const [latest, setLatest] = useState<OrgScanResult | null>(null);
  const [history, setHistory] = useState<OrgScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const [nextLatest, nextHistory] = await Promise.all([
        api.latestScan(),
        api.scanHistory()
      ]);
      setLatest(nextLatest);
      setHistory(nextHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load scan data");
    } finally {
      setLoading(false);
    }
  }

  async function runScan() {
    setLoading(true);
    setError(null);

    try {
      const nextLatest = await api.runScan();
      setLatest(nextLatest);
      setHistory(await api.scanHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="window-surface org-scan-window">
      <div className="window-header">
        <div>
          <p className="eyebrow">24/7 Org Scan</p>
          <h2>Health Monitor</h2>
        </div>
        <div className="header-actions">
          <button onClick={refresh} disabled={loading}>
            <RefreshCw size={17} />
            Refresh
          </button>
          <button className="primary-action" onClick={runScan} disabled={loading}>
            <Play size={17} />
            Run Scan
          </button>
        </div>
      </div>
      {error && <div className="inline-error">{error}</div>}

      <div className="scan-summary">
        <article className="metric-card">
          <span>Status</span>
          <strong>{latest?.healthStatus ?? "Not scanned"}</strong>
        </article>
        <article className="metric-card">
          <span>Risk Score</span>
          <strong>{latest?.riskScore ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>Org</span>
          <strong>{latest?.orgAlias ?? "dev-sandbox"}</strong>
        </article>
      </div>

      <div className="findings-band">
        <h3>
          <Activity size={18} />
          Findings
        </h3>
        {(latest?.findings ?? ["No findings recorded yet."]).map((finding) => (
          <div className="finding" key={finding}>
            <StatusPill label="Scan" tone="neutral" />
            <span>{finding}</span>
          </div>
        ))}
      </div>

      <div className="history-list">
        {history.map((scan) => (
          <div className="history-item" key={scan.id}>
            <span>{scan.createdAt}</span>
            <strong>{scan.healthStatus}</strong>
            <span>{scan.summary}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
