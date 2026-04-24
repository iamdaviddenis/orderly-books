import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.orderlybooks.app',
  appName: 'Orderly Books',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#f7f4ee',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#f7f4ee',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
}

export default config
