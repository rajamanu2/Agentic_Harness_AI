package com.agent.commandcenter.service;

import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class RiskEngineService {

    public int calculateRisk(String section, String action) {
        String normalizedSection = normalize(section);
        String normalizedAction = normalize(action);
        int score = 0;

        if (normalizedSection.contains("profile")) score += 40;
        if (normalizedSection.contains("permission")) score += 30;
        if (normalizedSection.contains("apex")) score += 30;
        if (normalizedSection.contains("trigger")) score += 35;
        if (normalizedSection.contains("flow")) score += 25;
        if (normalizedSection.contains("sharing")) score += 35;
        if (normalizedSection.contains("login")) score += 35;
        if (normalizedAction.contains("delete")) score += 40;
        if (normalizedAction.contains("activate")) score += 20;
        if (normalizedAction.contains("modify") || normalizedAction.contains("update")) score += 15;

        return Math.min(score, 100);
    }

    public String level(int riskScore) {
        if (riskScore >= 70) {
            return "High";
        }
        if (riskScore >= 35) {
            return "Medium";
        }
        return "Low";
    }

    public String recommendation(String section, String action, int riskScore) {
        if (riskScore >= 70) {
            return "Require human approval, confirm tests, and review permission impact.";
        }
        if (riskScore >= 35) {
            return "Review metadata diff and validate in sandbox before merging.";
        }
        if (normalize(action).contains("delete")) {
            return "Confirm no downstream dependency is removed.";
        }
        return "Log and monitor for related failures.";
    }

    private String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }
}
