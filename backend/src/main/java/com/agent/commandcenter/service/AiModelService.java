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
import java.util.List;
import java.util.Map;

@Service
public class AiModelService {

    private final CommandCenterProperties properties;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(20))
            .build();

    public AiModelService(
            CommandCenterProperties properties,
            AuditLogService auditLogService,
            ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
    }

    public Dto.AiProviderStatusResponse status() {
        CommandCenterProperties.Ai ai = properties.getAi();
        boolean configured = ai.getApiKey() != null && !ai.getApiKey().isBlank();
        return new Dto.AiProviderStatusResponse(
                ai.getProvider(),
                ai.getModel(),
                ai.getBaseUrl(),
                configured,
                configured
                        ? "GLM provider is configured."
                        : "GLM provider is ready, but AI_API_KEY is not set. The app will use placeholder planning."
        );
    }

    public Dto.AiChatResponse chat(String systemPrompt, String prompt) {
        CommandCenterProperties.Ai ai = properties.getAi();
        if (ai.getApiKey() == null || ai.getApiKey().isBlank()) {
            String placeholder = """
                    GLM placeholder response:
                    - Configure AI_API_KEY to call %s.
                    - Current model: %s.
                    - Request was accepted by the local orchestrator.
                    """.formatted(ai.getBaseUrl(), ai.getModel());
            return new Dto.AiChatResponse(ai.getProvider(), ai.getModel(), "PLACEHOLDER", placeholder);
        }

        try {
            String body = objectMapper.writeValueAsString(Map.of(
                    "model", ai.getModel(),
                    "messages", List.of(
                            Map.of("role", "system", "content", blankToDefault(systemPrompt, "You are a Salesforce delivery orchestration model.")),
                            Map.of("role", "user", "content", prompt)
                    ),
                    "temperature", 0.2
            ));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(chatCompletionsUrl(ai.getBaseUrl())))
                    .timeout(Duration.ofMinutes(2))
                    .header("Authorization", "Bearer " + ai.getApiKey())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                auditLogService.record("AI_MODEL_CALL_FAILED", "system", "glm", response.body(), Map.of("status", response.statusCode()));
                return new Dto.AiChatResponse(ai.getProvider(), ai.getModel(), "FAILED", "GLM call failed with HTTP " + response.statusCode());
            }

            String output = parseOutput(response.body());
            auditLogService.record("AI_MODEL_CALL_COMPLETED", "system", "glm", "GLM model call completed.", Map.of("model", ai.getModel()));
            return new Dto.AiChatResponse(ai.getProvider(), ai.getModel(), "COMPLETED", output);
        } catch (Exception exception) {
            auditLogService.record("AI_MODEL_CALL_FAILED", "system", "glm", exception.getMessage(), Map.of("model", ai.getModel()));
            return new Dto.AiChatResponse(ai.getProvider(), ai.getModel(), "FAILED", exception.getMessage());
        }
    }

    private String parseOutput(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        JsonNode choices = root.path("choices");
        if (choices.isArray() && choices.size() > 0) {
            return choices.get(0).path("message").path("content").asText(body);
        }
        return body;
    }

    private String chatCompletionsUrl(String baseUrl) {
        String trimmed = baseUrl == null || baseUrl.isBlank()
                ? "https://api.z.ai/api/paas/v4"
                : baseUrl.trim();
        if (trimmed.endsWith("/chat/completions")) {
            return trimmed;
        }
        return trimmed.replaceAll("/+$", "") + "/chat/completions";
    }

    private String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
