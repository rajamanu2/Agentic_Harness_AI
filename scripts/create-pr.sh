#!/usr/bin/env bash
set -euo pipefail

TITLE="${1:-AI: Salesforce delivery change}"
BODY_FILE="${2:-pr-body.md}"
REMOTE="${GITHUB_REMOTE:-origin}"

git push -u "$REMOTE" HEAD
gh pr create --title "$TITLE" --body-file "$BODY_FILE"
