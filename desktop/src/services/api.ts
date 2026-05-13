import type {
  AuditLog,
  AiProviderStatus,
  CodexRunResult,
  DeliveryRunResult,
  DeploymentValidation,
  HarnessRunResult,
  OrchestratorPlan,
  OrgChangesResponse,
  OrgLoginCommand,
  OrgScanResult,
  OrgStatus,
  SystemHello
} from "../types/commandCenter";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  hello: () => request<SystemHello>("/api/system/hello"),
  orgStatus: () => request<OrgStatus>("/api/org/status"),
  orgLoginCommand: () => request<OrgLoginCommand>("/api/org/login-command"),
  orgChanges: () => request<OrgChangesResponse>("/api/org/changes"),
  latestScan: () => request<OrgScanResult>("/api/org/scan/latest"),
  scanHistory: () => request<OrgScanResult[]>("/api/org/scan/history"),
  logs: () => request<AuditLog[]>("/api/logs"),
  runScan: () =>
    request<OrgScanResult>("/api/org/scan/run", {
      method: "POST",
      body: JSON.stringify({})
    }),
  runCodex: (repoPath: string, prompt: string) =>
    request<CodexRunResult>("/api/codex/run", {
      method: "POST",
      body: JSON.stringify({ repoPath, prompt })
    }),
  runDelivery: (requirement: string) =>
    request<DeliveryRunResult>("/api/delivery/run", {
      method: "POST",
      body: JSON.stringify({ requirement })
    }),
  aiProvider: () => request<AiProviderStatus>("/api/ai/provider"),
  planOrchestration: (requirement: string) =>
    request<OrchestratorPlan>("/api/ai/orchestrator/plan", {
      method: "POST",
      body: JSON.stringify({ requirement })
    }),
  runHarness: (environment: string, artifactVersion: string, inputYaml: string) =>
    request<HarnessRunResult>("/api/ai/harness/run", {
      method: "POST",
      body: JSON.stringify({ environment, artifactVersion, inputYaml })
    }),
  validateDeployment: () =>
    request<DeploymentValidation>("/api/deployment/validate", {
      method: "POST",
      body: JSON.stringify({})
    })
};
