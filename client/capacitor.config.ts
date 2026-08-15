import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.demoprivatesmartschool.app',
  appName: 'Demo Private Smart School',
  webDir: 'public',
  server: {
    url: 'https://demoprivatesmartschool.vercel.app',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1e293b",
      showSpinner: false,
      androidSpinnerStyle: "large",
      spinnerColor: "#f97316"
    }
  }
};

export default config;
