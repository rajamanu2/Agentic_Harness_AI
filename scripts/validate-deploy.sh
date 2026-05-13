#!/usr/bin/env bash
set -euo pipefail

ORG_ALIAS="${SALESFORCE_ORG_ALIAS:-dev-sandbox}"

sf project deploy start \
  --target-org "$ORG_ALIAS" \
  --dry-run \
  --test-level RunLocalTests \
  --json
