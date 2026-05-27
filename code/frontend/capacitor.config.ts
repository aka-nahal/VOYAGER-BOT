import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.voyagerbot.app',
  appName: 'Voyager Bot',
  webDir: 'out',
  server: {
    androidScheme: 'https', // Use https for better security
    cleartext: true, // Allow http for local development
    allowNavigation: ['*'], // Allow navigation to any URL
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
    allowMixedContent: true, // Allow mixed content for development
    captureInput: true, // Enable input capture
    webContentsDebuggingEnabled: true, // Enable web debugging
  },
  plugins: {
    // SplashScreen plugin configuration (install @capacitor/splash-screen if needed)
    // SplashScreen: {
    //   launchShowDuration: 2000,
    //   launchAutoHide: true,
    //   backgroundColor: '#000000',
    //   androidSplashResourceName: 'splash',
    //   androidScaleType: 'CENTER_CROP',
    //   showSpinner: false,
    //   splashFullScreen: true,
    //   splashImmersive: true,
    // },
  },
};

export default config;
