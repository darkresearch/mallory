# Mallory

> Full-featured AI chat app boilerplate with authentication, wallet integration, and dynamic UI components

Mallory is a production-ready mobile application boilerplate built with React Native and Expo, designed for developers who want to quickly build AI-powered chat applications with cryptocurrency wallet support.

## Features

- **AI Chat Interface**: Built with Vercel AI SDK for streaming chat responses
- **Dynamic UI Registry**: LLM-controllable components that can be rendered on-demand
- **Authentication**: Google OAuth integration with Supabase
- **Wallet Integration**: Solana wallet with Grid API support
- **Cross-Platform**: iOS, Android, and Web support via Expo
- **Modern Stack**: React Native, TypeScript, Supabase, Expo Router

## Tech Stack

- **Frontend**: React Native 0.81+ with Expo 54+
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context API
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **AI Integration**: Vercel AI SDK with Anthropic
- **Blockchain**: Solana Web3.js with Grid API
- **Styling**: Dark theme with custom components
- **Type Safety**: Full TypeScript coverage

## Getting Started

### Prerequisites

- Node.js 18+ or Bun (Bun recommended)
- iOS development: macOS with Xcode 14+
- Android development: Android Studio
- Expo CLI (optional, can use `bunx expo` instead)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/darkresearch/mallory.git
cd mallory
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration values (see Configuration section below).

4. **Generate native projects** (required for iOS/Android):
```bash
bun expo prebuild
```

This generates the `ios/` and `android/` folders with your app's branding from `app.config.js`.

5. Start the development server:
```bash
bun start
```

6. Run on your platform:
```bash
# Web (no prebuild needed)
bun run web

# iOS (requires step 4)
bun run ios

# Android (requires step 4)
bun run android
```

## Configuration

Mallory requires the following environment variables:

### Required

- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key (client-side key)
- `EXPO_PUBLIC_BACKEND_API_URL` - Your backend API endpoint (production only; dev uses localhost:3001)

### Optional (for full features)

- `EXPO_PUBLIC_WEB_OAUTH_REDIRECT_URL` - OAuth redirect URL for web-based Google login (defaults to http://localhost:8081)
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` - Google OAuth iOS Client ID (required for iOS native auth)
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` - Google OAuth Android Client ID (required for Android native auth)
- `EXPO_PUBLIC_SOLANA_RPC_URL` - Solana RPC endpoint for wallet features (defaults to mainnet-beta)
- `EXPO_PUBLIC_TERMS_URL` - Terms of Service URL (displayed on login screen if provided)
- `EXPO_PUBLIC_PRIVACY_URL` - Privacy Policy URL (displayed on login screen if provided)

See [.env.example](.env.example) for detailed configuration documentation.

### Branding Customization

Update `app.config.js` to customize your app:

- `name` - App display name
- `slug` - URL-friendly identifier
- `bundleIdentifier` / `package` - iOS/Android bundle identifiers
- `scheme` - Deep linking scheme
- Icons and splash screens in `assets/`

## Architecture

### Directory Structure

```
mallory/
├── app/                      # Expo Router pages
│   ├── (auth)/              # Authentication screens
│   └── (main)/              # Main app screens
├── components/              # Reusable components
│   ├── chat/               # Chat-specific components
│   ├── registry/           # Dynamic UI component registry
│   ├── ui/                 # Base UI components
│   └── wallet/             # Wallet components
├── contexts/               # React Context providers
├── features/               # Feature modules
│   ├── auth/              # Authentication logic
│   ├── chat/              # Chat functionality
│   ├── grid/              # Grid API integration
│   └── wallet/            # Wallet operations
├── hooks/                 # Custom React hooks
└── lib/                   # Utility libraries
```

### Key Design Patterns

**Component Registry System**: Dynamic components can be registered and rendered by the LLM in chat responses. See `components/registry/README.md` for details.

**Feature Modules**: Each major feature (auth, chat, wallet) is organized as a self-contained module with its own services, hooks, and components.

**Expo Router**: File-based routing with layout groups for authentication flow separation.

## Deployment

### Native Builds

The native `ios/` and `android/` folders are not included in the repository. Generate them first:

```bash
# Generate native folders from app.config.js
bun expo prebuild

# iOS: Install CocoaPods dependencies
cd ios && pod install && cd ..

# Build for iOS
bun run build:ios

# Build for Android
bun run build:android
```

**Note:** The prebuild command uses your `app.config.js` settings to generate properly configured native projects with your app name, bundle ID, and branding.

### Web Deployment

Build for web production:

```bash
bun run web:export
```

The output will be in the `dist/` directory, ready for deployment to any static hosting service.

### EAS Build (Recommended)

For managed cloud builds via Expo Application Services (no local Xcode/Android Studio needed):

```bash
# Install EAS CLI globally
bun add -g eas-cli

# Configure EAS (generates eas.json if needed)
eas build:configure

# Build for production
eas build --platform ios
eas build --platform android

# Or build both at once
eas build --platform all
```

**Benefits:**
- No need for local Xcode or Android Studio
- Builds in the cloud
- Automatic code signing
- Perfect for CI/CD

## Backend

Mallory is designed to work with a backend API. You have two options:

### Option 1: Hosted Backend (Recommended for production)

Contact [Dark](https://darkresearch.ai) for access to a managed backend instance. This includes:

- Production-ready API with monitoring
- Managed Supabase database
- Regular updates and support
- Enterprise SLA options

### Option 2: Self-Hosted Backend

Implement your own backend following the API contract documented in [docs/API.md](docs/API.md). You'll need to:

- Set up your own Supabase instance
- Implement the chat API endpoints
- Configure authentication flows
- Set up wallet integration (optional)

## Commercial Model

Mallory is free and open-source for self-hosted developers under the Apache 2.0 license.

**Enterprise White-Label Hosting**: Dark offers fully managed, white-labeled instances with:

- Custom branding and domain
- Production backend infrastructure
- Managed Supabase instance
- Priority support and SLA
- Regular updates and security patches

Contact hello@darkresearch.ai for pricing and details.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Reporting issues
- Submitting pull requests
- Code style and conventions
- Development workflow

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

## Support

- **Community Support**: GitHub Issues and Discussions (best effort)
- **Commercial Support**: Priority email/Slack support for enterprise customers
- **Documentation**: See the [docs](docs/) directory

## Credits

Built with ❤️ by [Dark](https://darkresearch.ai)

Mallory is an open-source AI chat boilerplate created by [Dark Research](https://darkresearch.ai).
