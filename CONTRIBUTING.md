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
3. Commit with clear, descriptive messages
4. Push to your fork
5. Open a Pull Request

## Pull Request Guidelines

### PR Title Format

Use conventional commit format:
- `feat: add new feature`
- `fix: resolve bug`
- `docs: update documentation`
- `chore: update dependencies`

### Version Releases

To trigger a version bump and release, add `[release: vX.Y.Z]` to your PR title:

```
feat: add wallet history [release: v0.2.0]
```

When merged to `main`:
- ✅ All packages bump to the new version
- ✅ Git tag created automatically
- ✅ GitHub release generated with changelog

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backwards compatible
- **PATCH** (0.0.1): Bug fixes, backwards compatible

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

All packages in the monorepo maintain synchronized versions. See [VERSION.md](../VERSION.md) for details.

## Questions?

- Open an issue for bugs or feature requests
- Reach out to hello@darkresearch.ai for questions

Thank you for contributing! 🙏
