# Mallory

> Full-featured AI chat app boilerplate with authentication, wallet integration, and dynamic UI components

Mallory is a production-ready mobile application boilerplate built with React Native and Expo, designed for developers who want to quickly build AI-powered chat applications with cryptocurrency wallet support.

## Features

- **AI Chat Interface**: Built with Vercel AI SDK for streaming chat responses
- **Dynamic UI Registry**: LLM-controllable components that can be rendered on-demand
- **Authentication**: Google OAuth integration with Supabase
- **Wallet Integration**: Solana wallet with Grid API support
- **Cross-Platform**: iOS, Android, and Web support via Expo
- **Internationalization**: Built-in i18n support with multiple languages
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

- Node.js 18+ or Bun
- iOS development: macOS with Xcode
- Android development: Android Studio
- Expo CLI (`npm install -g expo-cli`)

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

4. Start the development server:
```bash
bun start
```

5. Run on your platform:
```bash
# iOS
bun run ios

# Android
bun run android

# Web
bun run web
```

## Configuration

Mallory requires the following environment variables:

### Required

- `EXPO_PUBLIC_API_URL` - Your backend API endpoint
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Optional (for full features)

- `EXPO_PUBLIC_SOLANA_RPC_URL` - Solana RPC endpoint for wallet features
- `EXPO_PUBLIC_AUTH_REDIRECT_URL` - OAuth redirect URL for authentication
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` - Google OAuth Web Client ID
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` - Google OAuth iOS Client ID

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
├── lib/                   # Utility libraries
└── locales/              # i18n translations
```

### Key Design Patterns

**Component Registry System**: Dynamic components can be registered and rendered by the LLM in chat responses. See `components/registry/README.md` for details.

**Feature Modules**: Each major feature (auth, chat, wallet) is organized as a self-contained module with its own services, hooks, and components.

**Expo Router**: File-based routing with layout groups for authentication flow separation.

## Deployment

### Native Builds

For iOS and Android native builds, you'll need to run `expo prebuild` first:

```bash
# Generate native folders
expo prebuild

# iOS: Install CocoaPods dependencies
cd ios && pod install && cd ..

# Build for iOS
bun run build:ios

# Build for Android
bun run build:android
```

### Web Deployment

Build for web production:

```bash
bun run web:export
```

The output will be in the `dist/` directory, ready for deployment to any static hosting service.

### EAS Build (Recommended)

For managed builds via Expo Application Services:

```bash
# Configure EAS
eas build:configure

# Build for production
eas build --platform ios
eas build --platform android
```

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

Mallory is the open-source foundation of [Scout](https://scout.dark.xyz), Dark's production AI financial assistant.
