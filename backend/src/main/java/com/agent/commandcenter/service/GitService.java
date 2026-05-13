package com.agent.commandcenter.service;

import com.agent.commandcenter.config.CommandCenterProperties;
import org.springframework.stereotype.Service;

import java.io.File;
import java.time.Duration;
import java.util.List;

@Service
public class GitService {

    private final CommandCenterProperties properties;
    private final CommandRunner commandRunner;
    private final AuditLogService auditLogService;

    public GitService(
            CommandCenterProperties properties,
            CommandRunner commandRunner,
            AuditLogService auditLogService
    ) {
        this.properties = properties;
        this.commandRunner = commandRunner;
        this.auditLogService = auditLogService;
    }

    public String createBranch(String repoPath, String branchName) {
        File workingDirectory = new File(repoPath);
        if (!commandRunner.isAvailable("git") || !workingDirectory.exists()) {
            return "Skipped branch creation. Git is unavailable or repo path does not exist: " + repoPath;
        }

        CommandRunner.CommandResult result = commandRunner.run(
                List.of("git", "checkout", "-B", branchName),
                workingDirectory,
                Duration.ofSeconds(45)
        );

        String message = result.succeeded()
                ? "Checked out branch " + branchName
                : result.output();
        auditLogService.record("GIT_BRANCH", "system", "github", message, branchName);
        return message;
    }

    public String createPullRequest(String repoPath, String title, String bodyFile) {
        File workingDirectory = new File(repoPath);
        if (!commandRunner.isAvailable("gh") || !workingDirectory.exists()) {
            return "Skipped PR creation. GitHub CLI is unavailable or repo path does not exist.";
        }

        CommandRunner.CommandResult push = commandRunner.run(
                List.of("git", "push", "-u", properties.getGithub().getDefaultRemote(), "HEAD"),
                workingDirectory,
                Duration.ofMinutes(3)
        );

        if (!push.succeeded()) {
            return push.output();
        }

        CommandRunner.CommandResult pr = commandRunner.run(
                List.of("gh", "pr", "create", "--title", title, "--body-file", bodyFile),
                workingDirectory,
                Duration.ofMinutes(3)
        );

        auditLogService.record("GITHUB_PR", "system", "github", pr.output(), title);
        return pr.output();
    }
}
