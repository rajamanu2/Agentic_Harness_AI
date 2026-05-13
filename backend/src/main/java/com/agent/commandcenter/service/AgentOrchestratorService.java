package com.agent.commandcenter.service;

import com.agent.commandcenter.api.Dto;
import com.agent.commandcenter.config.CommandCenterProperties;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AgentOrchestratorService {

    private final CommandCenterProperties properties;
    private final AiModelService aiModelService;
    private final AuditLogService auditLogService;

    public AgentOrchestratorService(
            CommandCenterProperties properties,
            AiModelService aiModelService,
            AuditLogService auditLogService
    ) {
        this.properties = properties;
        this.aiModelService = aiModelService;
        this.auditLogService = auditLogService;
    }

    public Dto.OrchestratorPlanResponse plan(String requirement) {
        String id = UUID.randomUUID().toString();
        List<Dto.AgentStep> steps = agentSteps();
        Dto.AiChatResponse modelPlan = aiModelService.chat(
                """
                        You are the command-center orchestrator for Salesforce delivery.
                        Return concise planning notes. Do not claim that production changes are approved.
                        High-risk Salesforce actions require a human approval gate.
                        """,
                "Create an execution plan for this Salesforce requirement:\n\n" + requirement
        );

        String summary = modelPlan.output();
        auditLogService.record(
                "ORCHESTRATOR_PLAN_CREATED",
                "system",
                "orchestrator",
                "Multi-agent orchestration plan created.",
                Map.of("planId", id, "modelStatus", modelPlan.status())
        );

        return new Dto.OrchestratorPlanResponse(
                id,
                properties.getAi().getModel(),
                modelPlan.status(),
                steps,
                summary
        );
    }

    public List<Dto.AgentStep> agentSteps() {
        return List.of(
                new Dto.AgentStep("BA Agent", "Requirement analysis", "Create stories and acceptance criteria", false),
                new Dto.AgentStep("Salesforce Architect", "Solution design", "Choose objects, Apex, Flow, permissions, rollback plan", false),
                new Dto.AgentStep("Codex Engineer", "Implementation", "Generate isolated code/config changes and tests", false),
                new Dto.AgentStep("Salesforce Validator", "Sandbox validation", "Run dry-run deploy, tests, and org checks", false),
                new Dto.AgentStep("Harness Engineer", "Release orchestration", "Trigger configured Harness pipeline for deploy validation or release", true),
                new Dto.AgentStep("GitHub PR Engineer", "Code review handoff", "Create PR summary and attach validation evidence", false),
                new Dto.AgentStep("Org Safety Agent", "Risk control", "Block production/destructive changes until human approval", true)
        );
    }
}
