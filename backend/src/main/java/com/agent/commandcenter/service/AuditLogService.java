package com.agent.commandcenter.service;

import com.agent.commandcenter.api.Dto;
import com.agent.commandcenter.model.AuditLog;
import com.agent.commandcenter.repository.AuditLogRepository;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    public AuditLogService(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
    }

    public Dto.AuditLogResponse record(
            String eventType,
            String actor,
            String sourceSystem,
            String message,
            Object payload
    ) {
        AuditLog log = new AuditLog();
        log.setEventType(eventType);
        log.setActor(actor);
        log.setSourceSystem(sourceSystem);
        log.setMessage(message);
        log.setPayload(toJson(payload));

        AuditLog saved = auditLogRepository.save(log);
        return toResponse(saved);
    }

    public List<Dto.AuditLogResponse> recent() {
        return auditLogRepository.findTop100ByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private Dto.AuditLogResponse toResponse(AuditLog log) {
        return new Dto.AuditLogResponse(
                log.getId().toString(),
                log.getEventType(),
                log.getActor(),
                log.getSourceSystem(),
                log.getMessage(),
                log.getPayload(),
                log.getCreatedAt()
        );
    }

    private String toJson(Object payload) {
        if (payload == null) {
            return "{}";
        }

        if (payload instanceof String payloadText) {
            return payloadText;
        }

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JacksonException exception) {
            return "{\"serializationError\":\"" + exception.getMessage() + "\"}";
        }
    }

    public Dto.AuditLogResponse transientEvent(String message) {
        return new Dto.AuditLogResponse(
                UUID.randomUUID().toString(),
                "SYSTEM_TRANSIENT",
                "system",
                "backend",
                message,
                "{}",
                Instant.now()
        );
    }
}
