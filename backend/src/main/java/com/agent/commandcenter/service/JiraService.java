package com.agent.commandcenter.service;

import com.agent.commandcenter.api.Dto;
import com.agent.commandcenter.config.CommandCenterProperties;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
public class JiraService {

    private final CommandCenterProperties properties;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(20))
            .build();

    public JiraService(
            CommandCenterProperties properties,
            AuditLogService auditLogService,
            ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
    }

    public Dto.JiraIssueResult createIssue(String summary, String description, List<String> acceptanceCriteria) {
        CommandCenterProperties.Jira jira = properties.getJira();

        if (jira.getBaseUrl().isBlank() || jira.getEmail().isBlank() || jira.getApiToken().isBlank()) {
            Dto.JiraIssueResult placeholder = new Dto.JiraIssueResult(
                    jira.getProjectKey() + "-LOCAL",
                    "",
                    true
            );
            auditLogService.record("JIRA_PLACEHOLDER", "system", "jira", "Jira credentials are not configured.", placeholder);
            return placeholder;
        }

        try {
            Map<String, Object> payload = Map.of(
                    "fields", Map.of(
                            "project", Map.of("key", jira.getProjectKey()),
                            "summary", summary,
                            "description", adfDescription(description, acceptanceCriteria),
                            "issuetype", Map.of("name", "Story")
                    )
            );

            String auth = Base64.getEncoder()
                    .encodeToString((jira.getEmail() + ":" + jira.getApiToken()).getBytes(StandardCharsets.UTF_8));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(trimTrailingSlash(jira.getBaseUrl()) + "/rest/api/3/issue"))
                    .header("Authorization", "Basic " + auth)
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .timeout(Duration.ofSeconds(45))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() > 299) {
                throw new IllegalStateException(response.body());
            }

            String key = objectMapper.readTree(response.body()).path("key").asText();
            Dto.JiraIssueResult result = new Dto.JiraIssueResult(
                    key,
                    trimTrailingSlash(jira.getBaseUrl()) + "/browse/" + key,
                    false
            );
            auditLogService.record("JIRA_CREATED", "system", "jira", "Created Jira story " + key, result);
            return result;
        } catch (Exception exception) {
            auditLogService.record("JIRA_FAILED", "system", "jira", exception.getMessage(), summary);
            return new Dto.JiraIssueResult(jira.getProjectKey() + "-ERROR", "", true);
        }
    }

    private Map<String, Object> adfDescription(String description, List<String> acceptanceCriteria) {
        List<Map<String, Object>> content = new ArrayList<>();
        content.add(paragraph(description));

        if (acceptanceCriteria != null && !acceptanceCriteria.isEmpty()) {
            content.add(paragraph("Acceptance criteria"));
            acceptanceCriteria.stream()
                    .map(criteria -> paragraph("AC: " + criteria))
                    .forEach(content::add);
        }

        return Map.of(
                "type", "doc",
                "version", 1,
                "content", content
        );
    }

    private Map<String, Object> paragraph(String text) {
        return Map.of(
                "type", "paragraph",
                "content", List.of(Map.of("type", "text", "text", text))
        );
    }

    private String trimTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
