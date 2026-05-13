package com.agent.commandcenter.api;

import com.agent.commandcenter.config.CommandCenterProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
public class RootController {

    private final CommandCenterProperties properties;

    public RootController(CommandCenterProperties properties) {
        this.properties = properties;
    }

    @GetMapping("/")
    public ResponseEntity<Void> root() {
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, properties.getDesktopUrl())
                .build();
    }

    @GetMapping("/api")
    public Map<String, Object> apiIndex() {
        return Map.of(
                "app", "AI Salesforce Command Center",
                "status", "running",
                "desktopUrl", URI.create(properties.getDesktopUrl()).toString(),
                "endpoints", List.of(
                        "/api/system/hello",
                        "/api/org/status",
                        "/api/org/changes",
                        "/api/org/scan/latest",
                        "/api/logs",
                        "/api/delivery/run"
                )
        );
    }
}
