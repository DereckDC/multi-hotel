import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.roomia.pms',
  appName: 'Roomia',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'https://ais-pre-x2bbmoykvbb2j2cvvu5ybf-300435593784.us-east5.run.app',
      '*.supabase.co',
      '*'
    ]
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
