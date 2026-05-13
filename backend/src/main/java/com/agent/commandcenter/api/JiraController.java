package com.agent.commandcenter.api;

import com.agent.commandcenter.service.JiraService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/jira")
public class JiraController {

    private final JiraService jiraService;

    public JiraController(JiraService jiraService) {
        this.jiraService = jiraService;
    }

    @PostMapping("/story")
    public Dto.JiraIssueResult createStory(@Valid @RequestBody Dto.CreateStoryRequest request) {
        return jiraService.createIssue(request.summary(), request.description(), request.acceptanceCriteria());
    }
}
