package com.agent.commandcenter.api;

import com.agent.commandcenter.service.AuditLogService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/logs")
public class LogsController {

    private final AuditLogService auditLogService;

    public LogsController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public List<Dto.AuditLogResponse> logs() {
        return auditLogService.recent();
    }
}
