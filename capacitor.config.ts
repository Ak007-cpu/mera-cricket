import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.datavault.livecricket',
  appName: 'Live Cricket HD',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['*']
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'alert']
    },
    LocalNotifications: {
      smallIcon: 'res://drawable/ic_launcher',
      iconColor: '#2563eb'
    }
  }
};

export default config;
