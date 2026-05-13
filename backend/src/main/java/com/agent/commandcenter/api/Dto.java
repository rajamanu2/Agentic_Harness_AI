package com.agent.commandcenter.api;

import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.List;

public final class Dto {

    private Dto() {
    }

    public record SystemHelloResponse(
            String message,
            String app,
            String status,
            String userName,
            String connectedOrg,
            String activeBranch,
            String lastOrgScan,
            int pendingPrs,
            int criticalIssues
    ) {
    }

    public record OrgStatusResponse(
            String orgAlias,
            String status,
            String username,
            String instanceUrl,
            String message,
            String source
    ) {
    }

    public record OrgLoginCommandResponse(
            String orgAlias,
            String loginUrl,
            String command
    ) {
    }

    public record OrgChange(
            String id,
            String createdDate,
            String createdBy,
            String section,
            String action,
            String display,
            String riskLevel,
            int riskScore,
            String recommendation
    ) {
    }

    public record OrgChangesResponse(
            String orgAlias,
            String source,
            List<OrgChange> changes
    ) {
    }

    public record OrgScanResponse(
            String id,
            String orgAlias,
            String healthStatus,
            int riskScore,
            String summary,
            List<String> findings,
            Instant createdAt
    ) {
    }

    public record AuditLogResponse(
            String id,
            String eventType,
            String actor,
            String sourceSystem,
            String message,
            String payload,
            Instant createdAt
    ) {
    }

    public record RunCodexRequest(
            String repoPath,
            @NotBlank String prompt
    ) {
    }

    public record RunCodexResponse(
            String taskId,
            String status,
            String output,
            List<String> changedFiles
    ) {
    }

    public record DeliveryRunRequest(
            @NotBlank String requirement
    ) {
    }

    public record DeliveryRunResult(
            String id,
            String status,
            String summary,
            List<String> steps
    ) {
    }

    public record AiProviderStatusResponse(
            String provider,
            String model,
            String baseUrl,
            boolean configured,
            String message
    ) {
    }

    public record AiChatRequest(
            @NotBlank String prompt,
            String systemPrompt
    ) {
    }

    public record AiChatResponse(
            String provider,
            String model,
            String status,
            String output
    ) {
    }

    public record OrchestratorPlanRequest(
            @NotBlank String requirement
    ) {
    }

    public record AgentStep(
            String agent,
            String responsibility,
            String action,
            boolean approvalRequired
    ) {
    }

    public record OrchestratorPlanResponse(
            String id,
            String model,
            String status,
            List<AgentStep> steps,
            String summary
    ) {
    }

    public record HarnessRunRequest(
            String environment,
            String artifactVersion,
            String inputYaml
    ) {
    }

    public record HarnessRunResponse(
            String status,
            String message,
            String executionUrl
    ) {
    }

    public record DeliveryStatusResponse(
            String id,
            String status,
            List<String> steps,
            Instant updatedAt
    ) {
    }

    public record DeploymentValidationResponse(
            String status,
            String orgAlias,
            String output,
            Instant validatedAt
    ) {
    }

    public record CreateStoryRequest(
            @NotBlank String summary,
            @NotBlank String description,
            List<String> acceptanceCriteria
    ) {
    }

    public record JiraIssueResult(
            String key,
            String url,
            boolean placeholder
    ) {
    }
}
