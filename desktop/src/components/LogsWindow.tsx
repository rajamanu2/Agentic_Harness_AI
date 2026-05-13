import { RefreshCw, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { AuditLog } from "../types/commandCenter";

export function LogsWindow() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      setLogs(await api.logs());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load logs");
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
          <p className="eyebrow">Logs / Audit</p>
          <h2>System Activity</h2>
        </div>
        <button onClick={refresh} disabled={loading}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>
      {error && <div className="inline-error">{error}</div>}
      <div className="log-list">
        {logs.map((log) => (
          <article className="log-row" key={log.id}>
            <ScrollText size={18} />
            <div>
              <strong>{log.eventType}</strong>
              <p>{log.message}</p>
            </div>
            <span>{log.createdAt}</span>
          </article>
        ))}
        {!logs.length && <div className="empty-cell">No audit events yet.</div>}
      </div>
    </section>
  );
}
