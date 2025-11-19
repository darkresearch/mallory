# Changesets

This folder contains "changeset" files - each representing a pending change that will be included in the next release.

## For Contributors

When you make a change that affects users (new features, bug fixes, breaking changes), you need to create a changeset:

```bash
bun changeset
```

The interactive CLI will ask:
1. **Which packages changed?** (Select: client, server, shared, or all)
2. **What type of change?** (patch = bug fix, minor = new feature, major = breaking change)
3. **Summary**: Write a short description for the changelog

This creates a markdown file here that gets included in your PR.

## What Needs a Changeset?

**✅ Needs changeset:**
- Bug fixes
- New features
- Breaking changes
- Performance improvements
- User-facing changes

**❌ Skip changeset:**
- Documentation updates (use `skip-changeset` label)
- CI/tooling changes (use `skip-changeset` label)
- Tests only
- Code refactoring with no behavior change

## Release Process

1. Contributors add changesets in their PRs
2. PRs get merged with their changeset files
3. When ready to release, a maintainer runs: `bun changeset version`
4. This creates a "Version Packages" PR that:
   - Bumps package versions
   - Generates CHANGELOG.md from all pending changesets
   - Deletes the changeset files
5. Merge the "Version Packages" PR to trigger the release

## Learn More

https://github.com/changesets/changesets

