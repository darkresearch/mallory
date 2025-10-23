export default {
  expo: {
    name: "Mallory",
    slug: "mallory",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    scheme: "mallory",
    newArchEnabled: true,
    experiments: {
      typedRoutes: true
    },
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#05080C"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yourcompany.mallory",
      config: {
        usesNonExemptEncryption: false
      },
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ["mallory"]
          },
          {
            CFBundleURLSchemes: ["com.googleusercontent.apps.YOUR_GOOGLE_CLIENT_ID"]
          }
        ]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#05080C"
      },
      package: "com.yourcompany.mallory",
      permissions: [
        "INTERNET",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ],
      intentFilters: [
        {
          action: "VIEW",
          data: [
            {
              scheme: "https",
              host: "yourapp.example.com",
              pathPrefix: "/"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    fonts: [
      "./assets/fonts/Satoshi-Regular.ttf",
      "./assets/fonts/Satoshi-Medium.ttf",
      "./assets/fonts/Satoshi-Bold.ttf"
    ],
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 34,
            targetSdkVersion: 34,
            buildToolsVersion: "34.0.0",
            minSdkVersion: 21
          }
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "your-eas-project-id"
      },
      authRedirectUrl: process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL,
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      solanaRpcUrl: process.env.EXPO_PUBLIC_SOLANA_RPC_URL,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
    }
  }
};