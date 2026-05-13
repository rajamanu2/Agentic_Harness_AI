export type WindowName =
  | "HOME"
  | "JIRA"
  | "BROWSER"
  | "CODEX"
  | "ORG_CHANGES"
  | "ORG_SCAN"
  | "LOGS"
  | "DEPLOYMENT";

export type SystemHello = {
  message: string;
  app: string;
  status: string;
  userName: string;
  connectedOrg: string;
  activeBranch: string;
  lastOrgScan: string;
  pendingPrs: number;
  criticalIssues: number;
};

export type OrgChange = {
  id: string;
  createdDate: string;
  createdBy: string;
  section: string;
  action: string;
  display: string;
  riskLevel: "Low" | "Medium" | "High";
  riskScore: number;
  recommendation: string;
};

export type OrgChangesResponse = {
  orgAlias: string;
  source: string;
  changes: OrgChange[];
};

export type OrgStatus = {
  orgAlias: string;
  status: string;
  username: string;
  instanceUrl: string;
  message: string;
  source: string;
};

export type OrgLoginCommand = {
  orgAlias: string;
  loginUrl: string;
  command: string;
};

export type OrgScanResult = {
  id: string;
  orgAlias: string;
  healthStatus: string;
  riskScore: number;
  summary: string;
  findings: string[];
  createdAt: string;
};

export type AuditLog = {
  id: string;
  eventType: string;
  actor: string;
  sourceSystem: string;
  message: string;
  payload: string;
  createdAt: string;
};

export type CodexRunResult = {
  taskId: string;
  status: string;
  output: string;
  changedFiles: string[];
};

export type DeliveryRunResult = {
  id: string;
  status: string;
  summary: string;
  steps: string[];
};

export type DeploymentValidation = {
  status: string;
  orgAlias: string;
  output: string;
  validatedAt: string;
};

export type AiProviderStatus = {
  provider: string;
  model: string;
  baseUrl: string;
  configured: boolean;
  message: string;
};

export type AgentStep = {
  agent: string;
  responsibility: string;
  action: string;
  approvalRequired: boolean;
};

export type OrchestratorPlan = {
  id: string;
  model: string;
  status: string;
  steps: AgentStep[];
  summary: string;
};

export type HarnessRunResult = {
  status: string;
  message: string;
  executionUrl: string;
};
