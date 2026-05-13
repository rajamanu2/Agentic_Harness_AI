package com.agent.commandcenter.service;

import com.agent.commandcenter.api.Dto;
import com.agent.commandcenter.config.CommandCenterProperties;
import com.agent.commandcenter.model.OrgScanResult;
import com.agent.commandcenter.repository.OrgScanResultRepository;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
public class OrgScanService {

    private final CommandCenterProperties properties;
    private final SalesforceCliService salesforceCliService;
    private final OrgScanResultRepository orgScanResultRepository;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    public OrgScanService(
            CommandCenterProperties properties,
            SalesforceCliService salesforceCliService,
            OrgScanResultRepository orgScanResultRepository,
            AuditLogService auditLogService,
            ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.salesforceCliService = salesforceCliService;
        this.orgScanResultRepository = orgScanResultRepository;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
    }

    public Dto.OrgScanResponse runScan() {
        return runScan(properties.getSalesforce().getOrgAlias());
    }

    public Dto.OrgScanResponse runScan(String orgAlias) {
        auditLogService.record("ORG_SCAN_STARTED", "system", "scanner", "Org scan started.", Map.of("orgAlias", orgAlias));

        Dto.OrgChangesResponse changes = salesforceCliService.recentSetupChanges();
        int riskScore = changes.changes()
                .stream()
                .map(Dto.OrgChange::riskScore)
                .max(Comparator.naturalOrder())
                .orElse(0);
        String healthStatus = healthStatus(riskScore);
        List<String> findings = findings(changes, riskScore);

        OrgScanResult scanResult = new OrgScanResult();
        scanResult.setOrgAlias(orgAlias);
        scanResult.setHealthStatus(healthStatus);
        scanResult.setRiskScore(riskScore);
        scanResult.setSummary(summary(healthStatus, riskScore, findings.size()));
        scanResult.setFindingsJson(toJson(findings));
        scanResult.setRawResult(toJson(changes));

        OrgScanResult saved = orgScanResultRepository.save(scanResult);
        auditLogService.record(
                "ORG_SCAN_COMPLETED",
                "system",
                "scanner",
                "Org scan completed.",
                Map.of("orgAlias", orgAlias, "healthStatus", healthStatus, "riskScore", riskScore)
        );

        return toResponse(saved);
    }

    public Dto.OrgScanResponse latest() {
        return orgScanResultRepository.findTopByOrderByCreatedAtDesc()
                .map(this::toResponse)
                .orElseGet(this::emptyScan);
    }

    public List<Dto.OrgScanResponse> history() {
        return orgScanResultRepository.findTop25ByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private List<String> findings(Dto.OrgChangesResponse changes, int riskScore) {
        List<String> findings = changes.changes()
                .stream()
                .filter(change -> change.riskScore() >= 25)
                .map(change -> change.riskLevel() + ": " + change.section() + " - " + change.action() + " - " + change.display())
                .toList();

        if (!findings.isEmpty()) {
            return findings;
        }

        if (riskScore == 0) {
            return List.of("No recent setup changes returned by the Salesforce query.");
        }

        return List.of("No high-risk changes detected.");
    }

    private String healthStatus(int riskScore) {
        if (riskScore >= 70) {
            return "Critical";
        }
        if (riskScore >= 35) {
            return "Attention";
        }
        return "Healthy";
    }

    private String summary(String healthStatus, int riskScore, int findingCount) {
        return healthStatus + " with risk score " + riskScore + " across " + findingCount + " findings.";
    }

    private Dto.OrgScanResponse toResponse(OrgScanResult result) {
        return new Dto.OrgScanResponse(
                result.getId().toString(),
                result.getOrgAlias(),
                result.getHealthStatus(),
                result.getRiskScore(),
                result.getSummary(),
                fromJsonList(result.getFindingsJson()),
                result.getCreatedAt()
        );
    }

    private Dto.OrgScanResponse emptyScan() {
        return new Dto.OrgScanResponse(
                "not-scanned",
                properties.getSalesforce().getOrgAlias(),
                "Not scanned",
                0,
                "No org scan has run yet.",
                List.of("Run a scan to load SetupAuditTrail and health findings."),
                Instant.now()
        );
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            return "[]";
        }
    }

    private List<String> fromJsonList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }

        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (Exception exception) {
            return List.of(json);
        }
    }
}
