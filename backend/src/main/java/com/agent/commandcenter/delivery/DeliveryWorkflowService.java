package com.agent.commandcenter.delivery;

import com.agent.commandcenter.api.Dto;
import com.agent.commandcenter.config.CommandCenterProperties;
import com.agent.commandcenter.service.AuditLogService;
import com.agent.commandcenter.service.AgentOrchestratorService;
import com.agent.commandcenter.service.CodexService;
import com.agent.commandcenter.service.GitService;
import com.agent.commandcenter.service.HarnessService;
import com.agent.commandcenter.service.JiraService;
import com.agent.commandcenter.service.SalesforceCliService;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class DeliveryWorkflowService {

    private final CommandCenterProperties properties;
    private final JiraService jiraService;
    private final GitService gitService;
    private final CodexService codexService;
    private final SalesforceCliService salesforceCliService;
    private final AgentOrchestratorService agentOrchestratorService;
    private final HarnessService harnessService;
    private final AuditLogService auditLogService;
    private final Map<String, DeliveryRunState> runs = new ConcurrentHashMap<>();

    public DeliveryWorkflowService(
            CommandCenterProperties properties,
            JiraService jiraService,
            GitService gitService,
            CodexService codexService,
            SalesforceCliService salesforceCliService,
            AgentOrchestratorService agentOrchestratorService,
            HarnessService harnessService,
            AuditLogService auditLogService
    ) {
        this.properties = properties;
        this.jiraService = jiraService;
        this.gitService = gitService;
        this.codexService = codexService;
        this.salesforceCliService = salesforceCliService;
        this.agentOrchestratorService = agentOrchestratorService;
        this.harnessService = harnessService;
        this.auditLogService = auditLogService;
    }

    public Dto.DeliveryRunResult run(String requirement) {
        String id = UUID.randomUUID().toString();
        DeliveryRunState state = new DeliveryRunState(id, "RUNNING", new ArrayList<>(), Instant.now());
        runs.put(id, state);

        addStep(state, "Requirement received");
        auditLogService.record("DELIVERY_STARTED", "system", "delivery", requirement, Map.of("runId", id));

        Dto.OrchestratorPlanResponse plan = agentOrchestratorService.plan(requirement);
        addStep(state, "Orchestrator plan ready using " + plan.model() + " (" + plan.status() + ")");

        List<String> stories = generateStories(requirement);
        addStep(state, "Generated " + stories.size() + " placeholder user stories");

        String design = generateDesign(requirement);
        addStep(state, "Created placeholder Salesforce solution design");

        Dto.JiraIssueResult issue = jiraService.createIssue(
                titleFromRequirement(requirement),
                design,
                List.of("Lead assignment is deterministic", "Apex tests cover routing outcomes", "Sandbox validation completes")
        );
        addStep(state, "Jira story ready: " + issue.key());

        String repoPath = properties.getCodex().getDefaultRepoPath();
        String branchName = "ai/" + slug(requirement);
        addStep(state, gitService.createBranch(repoPath, branchName));

        Dto.RunCodexResponse codex = codexService.runCodex(repoPath, implementationPrompt(requirement, stories, design));
        addStep(state, "Codex status: " + codex.status());

        Dto.DeploymentValidationResponse validation = salesforceCliService.validateDeployment();
        addStep(state, "Sandbox validation: " + validation.status());

        Dto.HarnessRunResponse harness = harnessService.runPipeline(new Dto.HarnessRunRequest(
                "sandbox",
                branchName,
                "pipeline:\n  variables:\n    - name: orgAlias\n      value: " + properties.getSalesforce().getOrgAlias()
        ));
        addStep(state, "Harness Engineer: " + harness.status());

        if ("FAILED".equals(validation.status())) {
            Dto.RunCodexResponse fix = codexService.runCodex(
                    repoPath,
                    "Fix the Salesforce validation errors and keep the original requirement in scope.\n\n" + validation.output()
            );
            addStep(state, "Validation fix Codex status: " + fix.status());
        }

        addStep(state, gitService.createPullRequest(repoPath, "AI: " + titleFromRequirement(requirement), "pr-body.md"));
        state.status = "COMPLETED";
        state.updatedAt = Instant.now();

        auditLogService.record("DELIVERY_COMPLETED", "system", "delivery", "Delivery workflow completed.", Map.of("runId", id));

        return new Dto.DeliveryRunResult(
                id,
                state.status,
                "Requirement converted into stories, design, Jira, Codex task, validation, and PR step placeholders.",
                List.copyOf(state.steps)
        );
    }

    public Dto.DeliveryStatusResponse status(String id) {
        DeliveryRunState state = runs.get(id);
        if (state == null) {
            return new Dto.DeliveryStatusResponse(id, "UNKNOWN", List.of("No delivery run found."), Instant.now());
        }

        return new Dto.DeliveryStatusResponse(state.id, state.status, List.copyOf(state.steps), state.updatedAt);
    }

    private void addStep(DeliveryRunState state, String step) {
        state.steps.add(step);
        state.updatedAt = Instant.now();
    }

    private List<String> generateStories(String requirement) {
        return List.of(
                "As a sales operations manager, I want " + requirement,
                "As an administrator, I want clear configuration and rollback notes.",
                "As a release manager, I want sandbox validation before PR creation."
        );
    }

    private String generateDesign(String requirement) {
        return """
                Salesforce solution design:
                - Requirement: %s
                - Apex service owns assignment decisions.
                - Tests cover happy path, fallback owner, and missing data.
                - Deployment must be dry-run validated before PR.
                - TODO: Use OpenAI API to produce richer architecture notes.
                """.formatted(requirement);
    }

    private String implementationPrompt(String requirement, List<String> stories, String design) {
        return """
                Implement this Salesforce change.

                Requirement:
                %s

                Stories:
                %s

                Design:
                %s

                Keep changes isolated, add Apex tests, and do not hard-code secrets.
                """.formatted(requirement, String.join("\n", stories), design);
    }

    private String titleFromRequirement(String requirement) {
        String trimmed = requirement == null ? "Salesforce automation" : requirement.trim();
        if (trimmed.length() <= 80) {
            return trimmed;
        }
        return trimmed.substring(0, 77) + "...";
    }

    private String slug(String requirement) {
        String slug = requirement == null ? "salesforce-change" : requirement
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
        if (slug.isBlank()) {
            return "salesforce-change";
        }
        return slug.length() > 48 ? slug.substring(0, 48).replaceAll("-$", "") : slug;
    }

    private static final class DeliveryRunState {
        private final String id;
        private String status;
        private final List<String> steps;
        private Instant updatedAt;

        private DeliveryRunState(String id, String status, List<String> steps, Instant updatedAt) {
            this.id = id;
            this.status = status;
            this.steps = steps;
            this.updatedAt = updatedAt;
        }
    }
}
