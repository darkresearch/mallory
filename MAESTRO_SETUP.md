# Maestro E2E Testing Setup Guide

## What is Maestro?

Maestro is a mobile UI testing framework that allows you to write simple, declarative tests for iOS, Android, and React Native apps. It's perfect for testing complex flows like authentication.

## Installation

### macOS (your current system)

```bash
# Install Maestro CLI
curl -Ls "https://get.maestro.mobile.dev" | bash

# Add to PATH (add this to your ~/.zshrc)
export PATH="$PATH:$HOME/.maestro/bin"

# Reload shell
source ~/.zshrc

# Verify installation
maestro --version
```

### For CI/CD (GitHub Actions)

Maestro provides official GitHub Actions - we'll set this up later.

## Project Structure

```
mallory/
├── .maestro/                    # Maestro test directory
│   ├── config.yml              # Global configuration
│   ├── flows/                  # Test flows
│   │   ├── auth/
│   │   │   ├── new-user-signup.yaml
│   │   │   ├── returning-user.yaml
│   │   │   ├── incomplete-auth-recovery.yaml
│   │   │   └── logout.yaml
│   │   └── smoke/
│   │       └── basic-navigation.yaml
│   └── helpers/                # Reusable sub-flows
│       ├── login.yaml
│       └── complete-grid-otp.yaml
```

## Running Tests

```bash
# Run all tests
maestro test .maestro/flows

# Run specific test
maestro test .maestro/flows/auth/new-user-signup.yaml

# Run with specific app
maestro test --app apps/client/android/app/build/outputs/apk/debug/app-debug.apk .maestro/flows

# Run in continuous mode (watches for changes)
maestro test --continuous .maestro/flows
```

## Next Steps

1. ✅ Install Maestro CLI
2. ⏳ Create test configuration
3. ⏳ Set up test environment
4. ⏳ Write authentication tests
5. ⏳ Integrate with CI/CD

## Resources

- [Maestro Documentation](https://maestro.mobile.dev/)
- [Maestro GitHub](https://github.com/mobile-dev-inc/maestro)
- [Example Flows](https://maestro.mobile.dev/examples)

