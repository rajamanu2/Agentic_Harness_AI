package com.agent.commandcenter.api;

import com.agent.commandcenter.service.CodexService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/codex")
public class CodexController {

    private final CodexService codexService;

    public CodexController(CodexService codexService) {
        this.codexService = codexService;
    }

    @PostMapping("/run")
    public Dto.RunCodexResponse run(@Valid @RequestBody Dto.RunCodexRequest request) {
        return codexService.runCodex(request.repoPath(), request.prompt());
    }
}
