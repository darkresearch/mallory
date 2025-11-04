#!/bin/bash
# CI Monitoring Script for PR #47

set -e

PR_NUMBER=47
BRANCH="cursor/review-and-test-new-branch-functionality-226b"
EXPECTED_COMMIT="63212e7"

echo "🔍 Monitoring CI for PR #$PR_NUMBER"
echo "================================================"
echo ""

# Check PR sync status
echo "📌 Checking PR sync status..."
PR_HEAD=$(gh pr view $PR_NUMBER --json headRefOid --jq '.headRefOid' | cut -c1-7)
echo "   Expected commit: $EXPECTED_COMMIT"
echo "   PR head commit:  $PR_HEAD"

if [ "$PR_HEAD" != "$EXPECTED_COMMIT" ]; then
    echo "   ⚠️  PR not yet synced with latest commit"
    echo "   💡 This is normal and usually takes 1-2 minutes"
else
    echo "   ✅ PR is synced with latest commit"
fi

echo ""
echo "================================================"
echo ""

# Check for latest CI run
echo "🏃 Checking latest CI run..."
LATEST_RUN=$(gh run list --branch $BRANCH --limit 1 --json databaseId,headSha,status,conclusion,createdAt,workflowName --jq '.[0]')

if [ -z "$LATEST_RUN" ]; then
    echo "   ⚠️  No CI runs found"
else
    RUN_ID=$(echo $LATEST_RUN | jq -r '.databaseId')
    RUN_SHA=$(echo $LATEST_RUN | jq -r '.headSha' | cut -c1-7)
    RUN_STATUS=$(echo $LATEST_RUN | jq -r '.status')
    RUN_CONCLUSION=$(echo $LATEST_RUN | jq -r '.conclusion')
    RUN_WORKFLOW=$(echo $LATEST_RUN | jq -r '.workflowName')
    RUN_TIME=$(echo $LATEST_RUN | jq -r '.createdAt')
    
    echo "   Run ID: $RUN_ID"
    echo "   Commit: $RUN_SHA"
    echo "   Workflow: $RUN_WORKFLOW"
    echo "   Status: $RUN_STATUS"
    echo "   Conclusion: $RUN_CONCLUSION"
    echo "   Created: $RUN_TIME"
    echo ""
    
    if [ "$RUN_SHA" != "$EXPECTED_COMMIT" ]; then
        echo "   ⚠️  Latest run is for old commit"
        echo "   💡 Waiting for new CI run to start..."
    else
        echo "   ✅ Latest run is for our commit!"
    fi
fi

echo ""
echo "================================================"
echo ""

# Show current check status
echo "📋 Current Check Status:"
echo ""
gh pr checks $PR_NUMBER 2>&1 | grep -E "TypeScript Type Check|Unit Tests|Build Verification|Integration Tests|E2E Tests" | head -10 || echo "   No checks found yet"

echo ""
echo "================================================"
echo ""

# Show monitoring commands
echo "💡 Useful Commands:"
echo ""
echo "   Watch CI progress:"
echo "   gh pr checks $PR_NUMBER --watch"
echo ""
echo "   View latest run:"
echo "   gh run view $RUN_ID"
echo ""
echo "   View run logs:"
echo "   gh run view $RUN_ID --log"
echo ""
echo "   Re-run this script:"
echo "   bash monitor_ci.sh"
echo ""

echo "================================================"
echo ""

# Summary
echo "📊 Summary:"
echo ""
if [ "$PR_HEAD" == "$EXPECTED_COMMIT" ] && [ "$RUN_SHA" == "$EXPECTED_COMMIT" ]; then
    echo "   ✅ Everything synced - CI is running on our commit"
    echo "   ⏳ Waiting for CI results..."
elif [ "$PR_HEAD" != "$EXPECTED_COMMIT" ]; then
    echo "   ⏳ Waiting for GitHub to sync PR (usually 1-2 minutes)"
else
    echo "   ⏳ Waiting for CI to start on new commit"
fi

echo ""
echo "================================================"
