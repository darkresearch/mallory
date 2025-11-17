# Changesets Quick Start Guide

This guide explains how to use the new Changesets workflow.

## For Contributors

### When Making a PR

1. **Make your changes** as usual
2. **Run changeset** before committing:
   ```bash
   bun changeset
   ```
3. **Answer the prompts:**
   - Which packages? (Use spacebar to select, enter to confirm)
   - What type? (patch = fix, minor = feature, major = breaking)
   - Summary? (Describe what changed - goes in changelog)

4. **Commit the changeset file** with your code:
   ```bash
   git add .changeset/*.md
   git commit -m "feat: your change"
   ```

### Skip Changeset?

If your PR doesn't need a changelog entry (docs, tests, CI), add the `skip-changeset` label to your PR on GitHub.

## For Maintainers

### Releasing a New Version

When you're ready to bundle accumulated changes into a release:

1. **Create Version Packages PR:**
   ```bash
   bun changeset:version
   ```
   This:
   - Bumps package versions based on changesets
   - Generates/updates CHANGELOG.md
   - Deletes processed changeset files

2. **Review the Version Packages PR:**
   - Check the version bumps make sense
   - Review the generated CHANGELOG
   - Ensure all changesets were processed

3. **Merge the Version Packages PR**
   - This will trigger your release workflow
   - Packages get published (if configured)
   - GitHub release is created

### Example Timeline

```
Day 1: PR #100 merged (feat: add export) → includes .changeset/cool-pandas.md
Day 2: PR #101 merged (fix: auth bug) → includes .changeset/brave-lions.md  
Day 3: PR #102 merged (feat: new API) → includes .changeset/tiny-bears.md
Day 4: Run `bun changeset:version` → creates "Version Packages" PR
Day 5: Merge "Version Packages" PR → Release v0.2.0 🚀
```

## Commands Reference

```bash
# Add a changeset (interactive)
bun changeset

# Create Version Packages PR (maintainers only)
bun changeset:version

# Publish packages (if needed)
bun changeset:publish
```

## CI Checks

- **Changeset Bot**: Comments on PRs without changesets with instructions
- **Changeset Check**: Required check - blocks merge unless changeset exists or `skip-changeset` label added

## Migration from [release: vX.Y.Z]

The old workflow:
```
PR title: "feat: cool thing [release: v0.2.0]"
Merge → auto-bump version → auto-release
```

The new workflow:
```
PR: includes changeset file
Merge PR #1, #2, #3
Run: bun changeset:version
Merge: "Version Packages" PR
Result: Release v0.2.0 with all 3 changes
```

**Key difference**: You control when to release (batch multiple PRs).

## Learn More

- [Changesets Documentation](https://github.com/changesets/changesets)
- [Why Changesets?](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md)

