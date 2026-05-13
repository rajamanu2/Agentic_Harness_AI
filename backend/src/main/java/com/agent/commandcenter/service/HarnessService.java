package com.agent.commandcenter.service;

import com.agent.commandcenter.api.Dto;
import com.agent.commandcenter.config.CommandCenterProperties;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@Service
public class HarnessService {

    private final CommandCenterProperties properties;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(20))
            .build();

    public HarnessService(
            CommandCenterProperties properties,
            AuditLogService auditLogService,
            ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
    }

    public Dto.HarnessRunResponse runPipeline(Dto.HarnessRunRequest request) {
        CommandCenterProperties.Harness harness = properties.getHarness();
        if (harness.getTriggerUrl() == null || harness.getTriggerUrl().isBlank()) {
            return new Dto.HarnessRunResponse(
                    "PLACEHOLDER",
                    "Harness is wired into the orchestrator, but HARNESS_TRIGGER_URL is not configured.",
                    ""
            );
        }

        try {
            String body = objectMapper.writeValueAsString(Map.of(
                    "environment", blankToDefault(request.environment(), "sandbox"),
                    "artifactVersion", blankToDefault(request.artifactVersion(), "local"),
                    "inputYaml", blankToDefault(request.inputYaml(), "")
            ));

            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(harness.getTriggerUrl()))
                    .timeout(Duration.ofMinutes(2))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body));

            if (harness.getApiKey() != null && !harness.getApiKey().isBlank()) {
                builder.header("X-Api-Key", harness.getApiKey());
            }

            HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                auditLogService.record("HARNESS_PIPELINE_FAILED", "system", "harness", response.body(), Map.of("status", response.statusCode()));
                return new Dto.HarnessRunResponse("FAILED", "Harness trigger failed with HTTP " + response.statusCode(), "");
            }

            String executionUrl = executionUrl(response.body());
            auditLogService.record("HARNESS_PIPELINE_TRIGGERED", "system", "harness", "Harness pipeline trigger completed.", Map.of("executionUrl", executionUrl));
            return new Dto.HarnessRunResponse("TRIGGERED", "Harness pipeline trigger completed.", executionUrl);
        } catch (Exception exception) {
            auditLogService.record("HARNESS_PIPELINE_FAILED", "system", "harness", exception.getMessage(), Map.of());
            return new Dto.HarnessRunResponse("FAILED", exception.getMessage(), "");
        }
    }

    private String executionUrl(String body) throws Exception {
        JsonNode data = objectMapper.readTree(body).path("data");
        String uiUrl = data.path("uiUrl").asText("");
        if (!uiUrl.isBlank()) {
            return uiUrl;
        }
        return data.path("apiUrl").asText("");
    }

    private String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
