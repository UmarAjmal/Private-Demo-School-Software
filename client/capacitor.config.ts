import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartschool.app',
  appName: 'Demo Smart School',
  webDir: 'public',
  server: {
    url: 'https://demo-private-school.vercel.app',
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
