export default {
  expo: {
    name: "Vocera",
    slug: "vocera-voice-verification",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "vocera",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSMicrophoneUsageDescription: "This app needs access to your microphone to record Vox Key samples for voice verification.",
        NSUserTrackingUsageDescription: "This app uses data for voice verification purposes only."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      permissions: [
        "RECORD_AUDIO",
        "WRITE_EXTERNAL_STORAGE",
        "READ_EXTERNAL_STORAGE"
      ]
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-av",
        {
          microphonePermission: "Allow Vocera to access your microphone to record Vox Key samples for voice verification."
        }
      ],
      [
        "expo-secure-store"
      ]
    ],
    experiments: {
      typedRoutes: true
    }
  }
};
