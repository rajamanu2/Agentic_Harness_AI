package com.agent.commandcenter.api;

import com.agent.commandcenter.service.SalesforceCliService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/deployment")
public class DeploymentController {

    private final SalesforceCliService salesforceCliService;

    public DeploymentController(SalesforceCliService salesforceCliService) {
        this.salesforceCliService = salesforceCliService;
    }

    @PostMapping("/validate")
    public Dto.DeploymentValidationResponse validateDeployment() {
        return salesforceCliService.validateDeployment();
    }
}
