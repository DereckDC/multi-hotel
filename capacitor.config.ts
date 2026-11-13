import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.roomia.pms',
  appName: 'Roomia',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'roomiapms.site',
      '*.roomiapms.site',
      '*.supabase.co'
    ]
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
