#!/usr/bin/env bash
set -euo pipefail

# OJIX Contributor Sync Utility
# Synchronizes collaborator access for 'itsdeepakr' across all repositories of 'ojix-admin' (info@ojix.in)

TARGET_USER="itsdeepakr"
OWNER_ACCOUNT="ojix-admin"

echo "=== OJIX Contributor Sync ==="
echo "Target User: $TARGET_USER"
echo "Account:     $OWNER_ACCOUNT (info@ojix.in)"
echo "-----------------------------------"

# Ensure GitHub CLI is authenticated
if ! command -v gh &> /dev/null; then
  echo "Error: GitHub CLI (gh) is not installed."
  exit 1
fi

echo "Fetching all repositories for $OWNER_ACCOUNT..."
REPOS=$(gh repo list "$OWNER_ACCOUNT" --limit 200 --json name -q '.[].name')

COUNT=0
for REPO in $REPOS; do
  echo "Adding $TARGET_USER as collaborator to $OWNER_ACCOUNT/$REPO..."
  gh api -X PUT "/repos/$OWNER_ACCOUNT/$REPO/collaborators/$TARGET_USER" -f permission=push --silent || true
  COUNT=$((COUNT + 1))
done

echo "-----------------------------------"
echo "Successfully synced $COUNT repositories."

# If currently switched to itsdeepakr or able to accept invitations:
CURRENT_USER=$(gh api user -q '.login' 2>/dev/null || echo "")
if [ "$CURRENT_USER" = "$TARGET_USER" ]; then
  echo "Accepting any pending invitations for $TARGET_USER..."
  for INV_ID in $(gh api user/repository_invitations --jq '.[].id'); do
    echo "Accepting invitation $INV_ID..."
    gh api -X PATCH "/user/repository_invitations/$INV_ID" --silent || true
  done
  echo "All invitations accepted."
fi

echo "Done!"
