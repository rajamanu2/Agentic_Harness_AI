package com.agent.commandcenter.service;

import com.agent.commandcenter.api.Dto;
import com.agent.commandcenter.config.CommandCenterProperties;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.File;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class SalesforceCliService {

    private static final String SETUP_AUDIT_QUERY = """
            SELECT Id, Action, Section, CreatedDate, CreatedBy.Name, Display
            FROM SetupAuditTrail
            ORDER BY CreatedDate DESC
            LIMIT 50
            """;

    private final CommandCenterProperties properties;
    private final CommandRunner commandRunner;
    private final RiskEngineService riskEngineService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    public SalesforceCliService(
            CommandCenterProperties properties,
            CommandRunner commandRunner,
            RiskEngineService riskEngineService,
            AuditLogService auditLogService,
            ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.commandRunner = commandRunner;
        this.riskEngineService = riskEngineService;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
    }

    public Dto.OrgStatusResponse orgStatus() {
        String orgAlias = properties.getSalesforce().getOrgAlias();

        if (!commandRunner.isAvailable("sf")) {
            return new Dto.OrgStatusResponse(
                    orgAlias,
                    "NOT_READY",
                    "sf CLI not installed",
                    "",
                    "Install Salesforce CLI and run " + loginCommand().command(),
                    "salesforce-cli"
            );
        }

        CommandRunner.CommandResult result = commandRunner.run(List.of(
                "sf", "org", "display",
                "--target-org", orgAlias,
                "--json"
        ), null, Duration.ofSeconds(45));

        if (!result.succeeded()) {
            auditLogService.record("SALESFORCE_ORG_STATUS_FAILED", "system", "salesforce", result.output(), Map.of());
            if (isNotConnected(result.output())) {
                return new Dto.OrgStatusResponse(
                        orgAlias,
                        "NOT_CONNECTED",
                        "",
                        "",
                        "No Salesforce login was found for alias " + orgAlias + ". Run " + loginCommand().command() + ", then check again.",
                        "salesforce-cli"
                );
            }

            return new Dto.OrgStatusResponse(
                    orgAlias,
                    "CHECK_FAILED",
                    "",
                    "",
                    "Salesforce CLI could not check the org. See Logs for the full command output.",
                    "salesforce-cli"
            );
        }

        try {
            JsonNode root = objectMapper.readTree(result.output());
            JsonNode payload = root.path("result");
            return new Dto.OrgStatusResponse(
                    orgAlias,
                    "CONNECTED",
                    payload.path("username").asText("connected"),
                    payload.path("instanceUrl").asText(""),
                    "Salesforce CLI org display succeeded.",
                    "salesforce-cli"
            );
        } catch (Exception exception) {
            return new Dto.OrgStatusResponse(orgAlias, "CONNECTED", "", "", result.output(), "salesforce-cli");
        }
    }

    public Dto.OrgChangesResponse recentSetupChanges() {
        String orgAlias = properties.getSalesforce().getOrgAlias();

        if (!commandRunner.isAvailable("sf")) {
            return new Dto.OrgChangesResponse(orgAlias, "salesforce-cli-not-installed", List.of());
        }

        CommandRunner.CommandResult result = runSfCommand(List.of(
                "sf", "data", "query",
                "--target-org", orgAlias,
                "--query", SETUP_AUDIT_QUERY.replaceAll("\\s+", " ").trim(),
                "--json"
        ));

        if (!result.succeeded()) {
            auditLogService.record("SALESFORCE_ORG_CHANGES_FAILED", "system", "salesforce", result.output(), Map.of());
            return new Dto.OrgChangesResponse(
                    orgAlias,
                    isNotConnected(result.output()) ? "salesforce-cli-not-connected" : "salesforce-cli-error",
                    List.of()
            );
        }

        List<Dto.OrgChange> changes = parseSetupAuditTrail(result.output());
        auditLogService.record(
                "SALESFORCE_ORG_CHANGES_READ",
                "system",
                "salesforce",
                "Read recent SetupAuditTrail changes.",
                Map.of("count", changes.size())
        );
        return new Dto.OrgChangesResponse(orgAlias, "salesforce-cli", changes);
    }

    public Dto.OrgLoginCommandResponse loginCommand() {
        String orgAlias = properties.getSalesforce().getOrgAlias();
        String loginUrl = normalizeLoginUrl(properties.getSalesforce().getLoginUrl());
        return new Dto.OrgLoginCommandResponse(
                orgAlias,
                loginUrl,
                "sf org login web --alias " + orgAlias + " --instance-url " + loginUrl
        );
    }

    public Dto.DeploymentValidationResponse validateDeployment() {
        String orgAlias = properties.getSalesforce().getOrgAlias();

        if (!commandRunner.isAvailable("sf")) {
            return new Dto.DeploymentValidationResponse(
                    "SKIPPED",
                    orgAlias,
                    "Salesforce CLI is not installed. Install sf and authenticate the sandbox to run dry-run validation.",
                    Instant.now()
            );
        }

        CommandRunner.CommandResult result = runSfCommand(List.of(
                "sf", "project", "deploy", "start",
                "--target-org", orgAlias,
                "--dry-run",
                "--test-level", "RunLocalTests",
                "--json"
        ));

        String status = result.succeeded() ? "PASSED" : "FAILED";
        auditLogService.record(
                "SALESFORCE_DEPLOY_VALIDATE_" + status,
                "system",
                "salesforce",
                "Salesforce dry-run deployment validation completed.",
                Map.of("status", status, "output", result.output())
        );

        return new Dto.DeploymentValidationResponse(status, orgAlias, result.output(), Instant.now());
    }

    public CommandRunner.CommandResult runSfCommand(List<String> command) {
        return commandRunner.run(command, new File("."), Duration.ofMinutes(10));
    }

    private List<Dto.OrgChange> parseSetupAuditTrail(String output) {
        List<Dto.OrgChange> changes = new ArrayList<>();

        try {
            JsonNode records = objectMapper.readTree(output).path("result").path("records");
            if (!records.isArray()) {
                return changes;
            }

            for (JsonNode record : records) {
                String id = record.path("Id").asText();
                String section = record.path("Section").asText("Unknown");
                String action = record.path("Action").asText("Unknown");
                int risk = riskEngineService.calculateRisk(section, action);
                changes.add(new Dto.OrgChange(
                        id.isBlank() ? "audit-" + changes.size() : id,
                        record.path("CreatedDate").asText(""),
                        record.path("CreatedBy").path("Name").asText("Unknown"),
                        section,
                        action,
                        record.path("Display").asText(""),
                        riskEngineService.level(risk),
                        risk,
                        riskEngineService.recommendation(section, action, risk)
                ));
            }
        } catch (Exception exception) {
            auditLogService.record("SALESFORCE_ORG_CHANGES_PARSE_FAILED", "system", "salesforce", exception.getMessage(), output);
        }

        return changes;
    }

    private boolean isNotConnected(String output) {
        if (output == null) {
            return false;
        }

        String normalized = output.toLowerCase();
        return normalized.contains("namedorgnotfound")
                || normalized.contains("no authorization information found")
                || normalized.contains("no authorization information");
    }

    private String normalizeLoginUrl(String loginUrl) {
        if (loginUrl == null || loginUrl.isBlank()) {
            return "https://test.salesforce.com";
        }

        String trimmed = loginUrl.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed;
        }

        return "https://" + trimmed;
    }

    private Dto.OrgChange toChange(String id, String user, String section, String action, String display) {
        int risk = riskEngineService.calculateRisk(section, action);
        return new Dto.OrgChange(
                id,
                Instant.now().toString(),
                user,
                section,
                action,
                display,
                riskEngineService.level(risk),
                risk,
                riskEngineService.recommendation(section, action, risk)
        );
    }
}
