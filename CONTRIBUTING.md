# Contributing to Mallory

Thank you for your interest in contributing to Mallory! This document provides guidelines for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/mallory.git`
3. Install dependencies: `bun install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Workflow

### Running the App

```bash
# Start client (web)
cd apps/client && bun run web

# Start server
cd apps/server && bun run dev

# Run both (from root)
bun run dev
```

### Making Changes

1. Make your changes in a feature branch
2. Test your changes thoroughly
3. **Add a changeset** (if user-facing changes): `bun changeset`
4. Commit with clear, descriptive messages (include the changeset file)
5. Push to your fork
6. Open a Pull Request

## Changesets

We use [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs.

### When to Add a Changeset

**✅ Add changeset for:**
- Bug fixes
- New features  
- Breaking changes
- Performance improvements
- Any user-facing change

**❌ Skip changeset for:**
- Documentation updates (add `skip-changeset` label to PR)
- Test-only changes (add `skip-changeset` label to PR)
- CI/tooling updates (add `skip-changeset` label to PR)
- Code refactoring with no behavior change (add `skip-changeset` label to PR)

### How to Add a Changeset

```bash
# Run the interactive CLI
bun changeset
```

The CLI will prompt you for:
1. **Which packages changed?** (Use space to select, enter to confirm)
2. **Change type?** (patch/minor/major - see Semantic Versioning below)
3. **Summary**: Describe what changed (goes in the changelog)

This creates a markdown file in `.changeset/` that you commit with your changes.

### Example Workflow

```bash
# 1. Make your changes
git checkout -b feat/cool-feature
# ... edit files ...

# 2. Add changeset
bun changeset
# Select packages: client, shared
# Type: minor (new feature)
# Summary: "Added wallet export feature"

# 3. Commit everything
git add .
git commit -m "feat: add wallet export"
git push
```

### Release Process

1. Contributors add changesets to their PRs
2. Maintainers merge PRs (with changesets) into main
3. When ready to release, run: `bun changeset:version`
   - This creates a "Version Packages" PR
   - It bumps versions, generates CHANGELOG.md, deletes changeset files
4. Merge the "Version Packages" PR to trigger the release

## Pull Request Guidelines

### PR Title Format

Use conventional commit format:
- `feat: add new feature`
- `fix: resolve bug`
- `docs: update documentation`
- `chore: update dependencies`

### Changeset Requirement

Our CI will check for a changeset file in your PR. If your PR doesn't need one (docs, tests, CI), add the `skip-changeset` label.

## Versioning

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backwards compatible
- **PATCH** (0.0.1): Bug fixes, backwards compatible

Changesets will automatically bump versions based on the change types in pending changesets.

## Code Style

- Use TypeScript for type safety
- Follow existing code formatting
- Add comments for complex logic
- Write descriptive variable names

## Testing

```bash
# Run unit tests
cd apps/client && bun test:unit

# Run integration tests
cd apps/client && bun test:integration

# Run E2E tests
bun test:e2e:web
```

## Version Management

All packages in the monorepo maintain synchronized versions. See [VERSION.md](./VERSION.md) for details.

## Questions?

- Open an issue for bugs or feature requests
- Reach out to hello@darkresearch.ai for questions

Thank you for contributing! 🙏
