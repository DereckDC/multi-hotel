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
  },
  plugins: {
    // Barras del sistema con íconos claros, sobre el azul oscuro de la marca (Android 15+)
    SystemBars: {
      style: 'DARK'
    }
  }
};

export default config;
