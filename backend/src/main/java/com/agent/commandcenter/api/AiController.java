package com.agent.commandcenter.api;

import com.agent.commandcenter.service.AgentOrchestratorService;
import com.agent.commandcenter.service.AiModelService;
import com.agent.commandcenter.service.HarnessService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiModelService aiModelService;
    private final AgentOrchestratorService agentOrchestratorService;
    private final HarnessService harnessService;

    public AiController(
            AiModelService aiModelService,
            AgentOrchestratorService agentOrchestratorService,
            HarnessService harnessService
    ) {
        this.aiModelService = aiModelService;
        this.agentOrchestratorService = agentOrchestratorService;
        this.harnessService = harnessService;
    }

    @GetMapping("/provider")
    public Dto.AiProviderStatusResponse provider() {
        return aiModelService.status();
    }

    @PostMapping("/chat")
    public Dto.AiChatResponse chat(@Valid @RequestBody Dto.AiChatRequest request) {
        return aiModelService.chat(request.systemPrompt(), request.prompt());
    }

    @PostMapping("/orchestrator/plan")
    public Dto.OrchestratorPlanResponse orchestratorPlan(@Valid @RequestBody Dto.OrchestratorPlanRequest request) {
        return agentOrchestratorService.plan(request.requirement());
    }

    @PostMapping("/harness/run")
    public Dto.HarnessRunResponse harnessRun(@RequestBody Dto.HarnessRunRequest request) {
        return harnessService.runPipeline(request);
    }
}
