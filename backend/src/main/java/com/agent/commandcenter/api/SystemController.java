package com.agent.commandcenter.api;

import com.agent.commandcenter.config.CommandCenterProperties;
import com.agent.commandcenter.service.OrgScanService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/system")
public class SystemController {

    private final CommandCenterProperties properties;
    private final OrgScanService orgScanService;

    public SystemController(CommandCenterProperties properties, OrgScanService orgScanService) {
        this.properties = properties;
        this.orgScanService = orgScanService;
    }

    @GetMapping("/hello")
    public Dto.SystemHelloResponse hello() {
        Dto.OrgScanResponse latest = orgScanService.latest();
        return new Dto.SystemHelloResponse(
                "Hi, " + properties.getUserName(),
                "AI Salesforce Command Center",
                "running",
                properties.getUserName(),
                properties.getSalesforce().getOrgAlias(),
                "ai/lead-routing",
                latest.healthStatus(),
                0,
                "Critical".equals(latest.healthStatus()) ? 1 : 0
        );
    }
}
