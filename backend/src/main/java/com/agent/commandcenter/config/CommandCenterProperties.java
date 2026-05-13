package com.agent.commandcenter.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "command-center")
public class CommandCenterProperties {

    private String userName = "Manu";
    private String desktopUrl = "http://127.0.0.1:5173";
    private final Salesforce salesforce = new Salesforce();
    private final Codex codex = new Codex();
    private final Scan scan = new Scan();
    private final Jira jira = new Jira();
    private final Github github = new Github();
    private final Ai ai = new Ai();
    private final Harness harness = new Harness();

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getDesktopUrl() {
        return desktopUrl;
    }

    public void setDesktopUrl(String desktopUrl) {
        this.desktopUrl = desktopUrl;
    }

    public Salesforce getSalesforce() {
        return salesforce;
    }

    public Codex getCodex() {
        return codex;
    }

    public Scan getScan() {
        return scan;
    }

    public Jira getJira() {
        return jira;
    }

    public Github getGithub() {
        return github;
    }

    public Ai getAi() {
        return ai;
    }

    public Harness getHarness() {
        return harness;
    }

    public static class Salesforce {
        private String orgAlias = "dev-sandbox";
        private String loginUrl = "https://test.salesforce.com";

        public String getOrgAlias() {
            return orgAlias;
        }

        public void setOrgAlias(String orgAlias) {
            this.orgAlias = orgAlias;
        }

        public String getLoginUrl() {
            return loginUrl;
        }

        public void setLoginUrl(String loginUrl) {
            this.loginUrl = loginUrl;
        }
    }

    public static class Codex {
        private String defaultRepoPath = "../salesforce";

        public String getDefaultRepoPath() {
            return defaultRepoPath;
        }

        public void setDefaultRepoPath(String defaultRepoPath) {
            this.defaultRepoPath = defaultRepoPath;
        }
    }

    public static class Scan {
        private long fixedDelayMs = 900000;

        public long getFixedDelayMs() {
            return fixedDelayMs;
        }

        public void setFixedDelayMs(long fixedDelayMs) {
            this.fixedDelayMs = fixedDelayMs;
        }
    }

    public static class Jira {
        private String baseUrl = "";
        private String email = "";
        private String apiToken = "";
        private String projectKey = "SF";

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getApiToken() {
            return apiToken;
        }

        public void setApiToken(String apiToken) {
            this.apiToken = apiToken;
        }

        public String getProjectKey() {
            return projectKey;
        }

        public void setProjectKey(String projectKey) {
            this.projectKey = projectKey;
        }
    }

    public static class Github {
        private String defaultRemote = "origin";

        public String getDefaultRemote() {
            return defaultRemote;
        }

        public void setDefaultRemote(String defaultRemote) {
            this.defaultRemote = defaultRemote;
        }
    }

    public static class Ai {
        private String provider = "glm";
        private String model = "glm-5.1";
        private String baseUrl = "https://api.z.ai/api/paas/v4";
        private String apiKey = "";

        public String getProvider() {
            return provider;
        }

        public void setProvider(String provider) {
            this.provider = provider;
        }

        public String getModel() {
            return model;
        }

        public void setModel(String model) {
            this.model = model;
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }
    }

    public static class Harness {
        private String baseUrl = "https://app.harness.io";
        private String apiKey = "";
        private String accountIdentifier = "";
        private String orgIdentifier = "";
        private String projectIdentifier = "";
        private String pipelineIdentifier = "";
        private String triggerUrl = "";

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public String getAccountIdentifier() {
            return accountIdentifier;
        }

        public void setAccountIdentifier(String accountIdentifier) {
            this.accountIdentifier = accountIdentifier;
        }

        public String getOrgIdentifier() {
            return orgIdentifier;
        }

        public void setOrgIdentifier(String orgIdentifier) {
            this.orgIdentifier = orgIdentifier;
        }

        public String getProjectIdentifier() {
            return projectIdentifier;
        }

        public void setProjectIdentifier(String projectIdentifier) {
            this.projectIdentifier = projectIdentifier;
        }

        public String getPipelineIdentifier() {
            return pipelineIdentifier;
        }

        public void setPipelineIdentifier(String pipelineIdentifier) {
            this.pipelineIdentifier = pipelineIdentifier;
        }

        public String getTriggerUrl() {
            return triggerUrl;
        }

        public void setTriggerUrl(String triggerUrl) {
            this.triggerUrl = triggerUrl;
        }
    }
}
