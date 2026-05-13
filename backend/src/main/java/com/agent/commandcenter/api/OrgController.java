package com.agent.commandcenter.api;

import com.agent.commandcenter.service.OrgScanService;
import com.agent.commandcenter.service.SalesforceCliService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/org")
public class OrgController {

    private final SalesforceCliService salesforceCliService;
    private final OrgScanService orgScanService;

    public OrgController(SalesforceCliService salesforceCliService, OrgScanService orgScanService) {
        this.salesforceCliService = salesforceCliService;
        this.orgScanService = orgScanService;
    }

    @GetMapping("/status")
    public Dto.OrgStatusResponse status() {
        return salesforceCliService.orgStatus();
    }

    @GetMapping("/login-command")
    public Dto.OrgLoginCommandResponse loginCommand() {
        return salesforceCliService.loginCommand();
    }

    @GetMapping("/changes")
    public Dto.OrgChangesResponse changes() {
        return salesforceCliService.recentSetupChanges();
    }

    @GetMapping("/scan/latest")
    public Dto.OrgScanResponse latestScan() {
        return orgScanService.latest();
    }

    @GetMapping("/scan/history")
    public List<Dto.OrgScanResponse> scanHistory() {
        return orgScanService.history();
    }

    @PostMapping("/scan/run")
    public Dto.OrgScanResponse runScan() {
        return orgScanService.runScan();
    }
}
