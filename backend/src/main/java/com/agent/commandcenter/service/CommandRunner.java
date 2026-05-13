package com.agent.commandcenter.service;

import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class CommandRunner {

    public record CommandResult(int exitCode, String output) {
        public boolean succeeded() {
            return exitCode == 0;
        }
    }

    public boolean isAvailable(String executable) {
        String finder = isWindows() ? "where" : "which";
        try {
            return run(List.of(finder, executable), null, Duration.ofSeconds(5)).succeeded();
        } catch (Exception ignored) {
            return false;
        }
    }

    public CommandResult run(List<String> command, File workingDirectory, Duration timeout) {
        try {
            ProcessBuilder processBuilder = new ProcessBuilder(effectiveCommand(command));
            processBuilder.redirectErrorStream(true);

            if (workingDirectory != null && workingDirectory.exists()) {
                processBuilder.directory(workingDirectory);
            }

            Process process = processBuilder.start();
            CompletableFuture<String> outputFuture = CompletableFuture.supplyAsync(() -> readOutput(process));
            boolean finished = process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);

            if (!finished) {
                process.destroyForcibly();
                return new CommandResult(-1, "Command timed out: " + String.join(" ", command));
            }

            String output = outputFuture.get(5, TimeUnit.SECONDS);
            return new CommandResult(process.exitValue(), output.trim());
        } catch (IOException exception) {
            return new CommandResult(-1, exception.getMessage());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return new CommandResult(-1, "Command interrupted");
        } catch (ExecutionException exception) {
            return new CommandResult(-1, exception.getMessage());
        } catch (java.util.concurrent.TimeoutException exception) {
            return new CommandResult(-1, "Timed out reading command output");
        }
    }

    private List<String> effectiveCommand(List<String> command) {
        if (!isWindows()) {
            return command;
        }

        List<String> effective = new ArrayList<>();
        effective.add("cmd.exe");
        effective.add("/d");
        effective.add("/s");
        effective.add("/c");
        effective.add(command.stream().map(this::quoteForCmd).collect(Collectors.joining(" ")));
        return effective;
    }

    private String quoteForCmd(String value) {
        if (value.matches("[A-Za-z0-9_./:\\\\=-]+")) {
            return value;
        }
        return "\"" + value.replace("\"", "\\\"") + "\"";
    }

    private String readOutput(Process process) {
        try {
            return new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException exception) {
            return exception.getMessage();
        }
    }

    private boolean isWindows() {
        return System.getProperty("os.name")
                .toLowerCase(Locale.ROOT)
                .contains("win");
    }
}
