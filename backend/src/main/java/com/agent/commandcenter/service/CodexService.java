package com.agent.commandcenter.service;

import com.agent.commandcenter.api.Dto;
import com.agent.commandcenter.config.CommandCenterProperties;
import com.agent.commandcenter.model.AiTask;
import com.agent.commandcenter.repository.AiTaskRepository;
import org.springframework.stereotype.Service;

import java.io.File;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Service
public class CodexService {

    private final CommandCenterProperties properties;
    private final CommandRunner commandRunner;
    private final AiTaskRepository aiTaskRepository;
    private final AuditLogService auditLogService;

    public CodexService(
            CommandCenterProperties properties,
            CommandRunner commandRunner,
            AiTaskRepository aiTaskRepository,
            AuditLogService auditLogService
    ) {
        this.properties = properties;
        this.commandRunner = commandRunner;
        this.aiTaskRepository = aiTaskRepository;
        this.auditLogService = auditLogService;
    }

    public Dto.RunCodexResponse runCodex(String repoPath, String prompt) {
        String effectiveRepoPath = repoPath == null || repoPath.isBlank()
                ? properties.getCodex().getDefaultRepoPath()
                : repoPath;

        AiTask task = new AiTask();
        task.setTaskType("CODEX_RUN");
        task.setStatus("RUNNING");
        task.setInput(prompt);
        task = aiTaskRepository.save(task);

        auditLogService.record(
                "CODEX_STARTED",
                "system",
                "codex",
                "Codex task started.",
                Map.of("repoPath", effectiveRepoPath, "taskId", task.getId().toString())
        );

        if (!commandRunner.isAvailable("codex")) {
            String output = "Codex CLI is not installed. Install @openai/codex and rerun this task.";
            completeTask(task, "SKIPPED", output);
            return new Dto.RunCodexResponse(task.getId().toString(), "SKIPPED", output, List.of());
        }

        File workingDirectory = new File(effectiveRepoPath);
        CommandRunner.CommandResult result = commandRunner.run(
                List.of("codex", prompt),
                workingDirectory,
                Duration.ofMinutes(20)
        );

        String status = result.succeeded() ? "COMPLETED" : result.exitCode() == -1 ? "SKIPPED" : "FAILED";
        completeTask(task, status, result.output());

        auditLogService.record(
                "CODEX_" + status,
                "system",
                "codex",
                "Codex task finished.",
                Map.of("taskId", task.getId().toString(), "exitCode", result.exitCode())
        );

        return new Dto.RunCodexResponse(
                task.getId().toString(),
                status,
                result.output(),
                changedFiles(workingDirectory)
        );
    }

    private void completeTask(AiTask task, String status, String output) {
        task.setStatus(status);
        task.setOutput(output);
        task.setCompletedAt(Instant.now());
        aiTaskRepository.save(task);
    }

    private List<String> changedFiles(File workingDirectory) {
        if (!workingDirectory.exists() || !commandRunner.isAvailable("git")) {
            return List.of();
        }

        CommandRunner.CommandResult result = commandRunner.run(
                List.of("git", "status", "--short"),
                workingDirectory,
                Duration.ofSeconds(20)
        );

        if (!result.succeeded() || result.output().isBlank()) {
            return List.of();
        }

        return Arrays.stream(result.output().split("\\R"))
                .map(String::trim)
                .filter(line -> !line.isBlank())
                .toList();
    }
}
