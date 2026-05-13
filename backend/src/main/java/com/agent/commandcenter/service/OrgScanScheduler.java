package com.agent.commandcenter.service;

import com.agent.commandcenter.config.CommandCenterProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class OrgScanScheduler {

    private final CommandCenterProperties properties;
    private final OrgScanService orgScanService;

    public OrgScanScheduler(CommandCenterProperties properties, OrgScanService orgScanService) {
        this.properties = properties;
        this.orgScanService = orgScanService;
    }

    @Scheduled(fixedDelayString = "${command-center.scan.fixed-delay-ms:900000}")
    public void scanEvery15Minutes() {
        try {
            orgScanService.runScan(properties.getSalesforce().getOrgAlias());
        } catch (Exception ignored) {
            // Scheduled scans must never stop the API process.
        }
    }
}
