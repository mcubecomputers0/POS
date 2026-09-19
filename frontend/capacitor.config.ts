import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cloudgst.pos',
  appName: 'வணிகம் (Vanigam)',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true, // Allows connecting to local development servers over HTTP
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0f172a',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true, // Bypasses browser CORS by sending requests via native Android networking
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
