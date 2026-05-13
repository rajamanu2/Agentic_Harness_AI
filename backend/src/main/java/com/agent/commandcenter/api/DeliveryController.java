package com.agent.commandcenter.api;

import com.agent.commandcenter.delivery.DeliveryWorkflowService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/delivery")
public class DeliveryController {

    private final DeliveryWorkflowService deliveryWorkflowService;

    public DeliveryController(DeliveryWorkflowService deliveryWorkflowService) {
        this.deliveryWorkflowService = deliveryWorkflowService;
    }

    @PostMapping("/run")
    public Dto.DeliveryRunResult run(@Valid @RequestBody Dto.DeliveryRunRequest request) {
        return deliveryWorkflowService.run(request.requirement());
    }

    @GetMapping("/{id}/status")
    public Dto.DeliveryStatusResponse status(@PathVariable String id) {
        return deliveryWorkflowService.status(id);
    }
}
