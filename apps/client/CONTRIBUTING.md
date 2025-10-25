# Contributing to Mallory

Thank you for your interest in contributing to Mallory! This document provides guidelines and information for contributors.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful and constructive in all interactions.

## How to Contribute

### Reporting Issues

If you encounter a bug or have a feature request:

1. **Search existing issues** to avoid duplicates
2. **Create a new issue** with a clear title and description
3. **Include reproduction steps** for bugs
4. **Provide context** for feature requests

**Good issue example:**
```
Title: Chat messages not displaying on Android 13

Description:
On Android 13 devices, chat messages from the AI don't appear
in the message list after sending.

Steps to reproduce:
1. Start app on Android 13
2. Send a message in chat
3. Observe that AI response doesn't appear

Expected: AI response should appear in chat
Actual: Message list stays empty

Environment:
- Android version: 13
- Device: Pixel 6
- Mallory version: 1.0.0
```

### Submitting Pull Requests

1. **Fork the repository** and create a branch from `main`
2. **Make your changes** following the code style guidelines
3. **Write tests** if adding new functionality
4. **Update documentation** as needed
5. **Submit a pull request** with a clear description

**Pull Request Guidelines:**

- Use descriptive commit messages
- Reference related issues (e.g., "Fixes #123")
- Keep changes focused and atomic
- Ensure all tests pass
- Update README if adding features

**Good PR example:**
```
Title: Add support for markdown tables in chat

Description:
Implements rendering of markdown tables in chat messages using
the StreamdownRN library's table support.

Changes:
- Add table parsing to SimpleMessageRenderer
- Update StreamdownRN to v2.1.0
- Add table styling to dark theme
- Add tests for table rendering

Fixes #456
```

## Development Setup

### Prerequisites

- Node.js 18+ or Bun
- iOS development: macOS with Xcode
- Android development: Android Studio
- Expo CLI

### Local Development

1. Clone your fork:
```bash
git clone https://github.com/your-username/mallory.git
cd mallory
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start development server:
```bash
bun start
```

5. Run on your platform:
```bash
bun run ios      # iOS
bun run android  # Android
bun run web      # Web
```

### Running Tests

```bash
# Type checking
bun run type-check

# Linting (if configured)
bun run lint
```

## Code Style

### TypeScript

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

**Good example:**
```typescript
/**
 * Formats a timestamp for display in chat
 * @param timestamp - ISO 8601 timestamp string
 * @returns Human-readable time string (e.g., "2:30 PM")
 */
export function formatChatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}
```

### React Components

- Use functional components with hooks
- Extract reusable logic into custom hooks
- Keep components focused and single-purpose
- Use TypeScript interfaces for props

**Good example:**
```typescript
interface MessageProps {
  content: string;
  timestamp: string;
  isUser: boolean;
}

export const Message: React.FC<MessageProps> = ({
  content,
  timestamp,
  isUser
}) => {
  const formattedTime = formatChatTime(timestamp);
  
  return (
    <View style={isUser ? styles.userMessage : styles.aiMessage}>
      <Text style={styles.content}>{content}</Text>
      <Text style={styles.timestamp}>{formattedTime}</Text>
    </View>
  );
};
```

### File Organization

- Place components in appropriate directories
- Use index files to export public APIs
- Keep feature modules self-contained
- Follow existing directory structure

## Feature Development

### Adding New Features

1. **Discuss first**: Open an issue to discuss the feature
2. **Plan the architecture**: Consider how it fits with existing code
3. **Implement incrementally**: Small, focused changes
4. **Document thoroughly**: Update README and add inline docs
5. **Test comprehensively**: Manual and automated testing

### Dynamic UI Components

When adding components to the dynamic UI registry:

1. Create component in `components/ui/`
2. Define props schema in `components/registry/ComponentDefinitions.ts`
3. Add examples for LLM usage
4. Update registry README
5. Test with actual LLM responses

See `components/registry/README.md` for detailed guidelines.

## Testing

### Manual Testing

Before submitting a PR, test your changes on:

- **iOS** (if affected)
- **Android** (if affected)
- **Web** (if affected)
- **Different screen sizes**
- **Dark theme** (our default)

### Testing Checklist

- [ ] Code compiles without errors
- [ ] No TypeScript errors
- [ ] Feature works as expected
- [ ] No regressions in existing features
- [ ] UI looks good on different devices
- [ ] Accessible (screen readers, keyboard nav if applicable)

## Documentation

### Code Documentation

- Add JSDoc comments for public functions
- Explain complex logic with inline comments
- Document component props with TypeScript interfaces
- Update README for new features

### README Updates

When adding features that affect users:

- Update the Features section
- Add configuration steps if needed
- Include examples
- Update screenshots/GIFs if UI changed

## Community Support

### Support Channels

**Open Source Community:**
- GitHub Issues - Bug reports and feature requests
- GitHub Discussions - General questions and ideas
- Best effort community support

**Commercial Customers:**
- Priority email support: support@darkresearch.ai
- Slack channel access
- Guaranteed response times (SLA-based)

### Getting Help

If you need help with your contribution:

1. Check existing documentation
2. Search closed issues and PRs
3. Ask in GitHub Discussions
4. Tag maintainers if urgent

## Recognition

Contributors will be recognized in:

- GitHub contributors list
- Release notes for significant contributions
- Special thanks for major features

## License

By contributing to Mallory, you agree that your contributions will be licensed under the Apache License 2.0.

All contributions must:

- Be your original work or properly attributed
- Not violate any third-party licenses
- Include appropriate copyright headers
- Be compatible with Apache 2.0

## Questions?

If you have questions about contributing:

- Open a Discussion on GitHub
- Contact the maintainers
- Check the documentation

Thank you for helping make Mallory better!

