---
name: forgeos
description: Use the ForgeOS neural engine, learned lessons, technology scanner, Salesforce control plane, and approval-aware delivery workflow from a ForgeOS session.
---

# ForgeOS

Use this skill when a task benefits from ForgeOS planning, learning, repository intelligence, or Salesforce capabilities.

## Routing

1. Call `agentica_status` before depending on the ForgeOS intelligence service.
2. For an unfamiliar repository, call `agentica_scan` before planning commands.
3. Use `agentica_neural_plan` when intent classification, learned lessons, or teacher routing adds value.
4. Use `agentica_teacher_ensemble` only when multiple configured models would materially improve a decision.
5. Use `agentica_learn` only for a durable, general lesson supported by a completed or externally verified result.
6. For Salesforce, call `salesforce_org_status` first and always name the target org explicitly.
7. Use `salesforce_validate` for dry-run validation. Do not turn validation into deployment.
8. Use `delivery_plan` for Jira, Git, Harness, and approval coordination.

## Completion

- Treat model output as a proposal, not proof.
- Prefer repository-native build and test commands detected by `agentica_scan`.
- Report exact changed files, checks, target systems, identifiers, and exclusions.
- Link conclusions to tool receipts and the `.forgeos/evidence/<run-id>/events.jsonl` chain.
