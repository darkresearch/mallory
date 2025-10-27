# Contributing to Mallory

Thank you for your interest in contributing to Mallory! This guide will help you get started.

## 🏗️ Monorepo Structure

Mallory is organized as a Bun workspace monorepo:

```
mallory/
├── apps/
│   ├── client/          # React Native app
│   └── server/          # Backend API
├── packages/
│   └── shared/          # Shared TypeScript types
└── package.json         # Workspace config
```

## 🚀 Development Setup

### Prerequisites
- Node.js 18+ or Bun
- Git
- For native development: Xcode (iOS) or Android Studio (Android)

### Installation

1. **Fork and clone:**
```bash
git clone https://github.com/your-username/mallory.git
cd mallory
```

2. **Install dependencies:**
```bash
bun install
```

3. **Set up environment variables:**
```bash
# Client
cp apps/client/.env.example apps/client/.env
# Edit apps/client/.env with your credentials

# Server
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env with your API keys
```

4. **Start development servers:**
```bash
# Both client and server
bun run dev

# Or separately
bun run client  # Client web dev server
bun run server  # Backend API server
```

## 📝 Making Changes

### Code Style
- Use TypeScript for all new code
- Follow existing code conventions
- Run type checking before committing: `bun run type-check`

### Commit Messages
Follow conventional commits:
```
feat: Add new feature
fix: Fix bug
docs: Update documentation
refactor: Refactor code
test: Add tests
chore: Update dependencies
```

### Branch Strategy
- `main` - Production-ready code
- `develop` - Development branch
- `feature/*` - New features
- `fix/*` - Bug fixes

## 🔍 Pull Request Process

1. **Create a feature branch:**
```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes:**
- Write clear, concise code
- Add comments for complex logic
- Update documentation if needed

3. **Test your changes:**
```bash
# Type check
cd apps/client && bun run type-check
cd apps/server && bun run type-check

# Test client (web)
cd apps/client && bun run web

# Test server
cd apps/server && bun run dev
```

4. **Commit and push:**
```bash
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature-name
```

5. **Open pull request:**
- Clear description of changes
- Reference any related issues
- Include screenshots for UI changes

## 🧩 Working with Packages

### Client (apps/client/)
React Native app using Expo.

**Key directories:**
- `app/` - Expo Router screens
- `components/` - Reusable components
- `features/` - Feature modules (chat, wallet, grid)
- `contexts/` - React contexts
- `hooks/` - Custom hooks
- `lib/` - Utilities and configuration

### Server (apps/server/)
Express.js backend API.

**Key directories:**
- `src/routes/` - API endpoint handlers
- `src/middleware/` - Express middleware
- `src/lib/` - Utilities and services

### Shared (packages/shared/)
Shared TypeScript types.

**Key files:**
- `src/types/api.ts` - API request/response types
- `src/types/wallet.ts` - Wallet-related types

## 🐛 Reporting Issues

Before creating an issue:
1. Check if the issue already exists
2. Provide clear reproduction steps
3. Include environment details (OS, Node version, etc.)
4. Add relevant error messages/logs

## 💡 Feature Requests

We welcome feature requests! Please:
1. Check existing discussions first
2. Clearly describe the use case
3. Explain why it benefits the community
4. Consider contributing the implementation

## 🔐 Security

Found a security issue? Please email hello@darkresearch.ai instead of creating a public issue.

## 📄 License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

## 🙏 Questions?

- GitHub Discussions: https://github.com/darkresearch/mallory/discussions
- Email: hello@darkresearch.ai

Thank you for contributing to Mallory! 🚀

