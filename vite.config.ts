import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import https from 'https';
import {defineConfig} from 'vite';

// Automatically download official brand logo on startup to avoid expired Instagram URLs
try {
  const publicDir = path.resolve(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const logoPath = path.join(publicDir, 'logo-official.jpg');
  if (!fs.existsSync(logoPath) || fs.statSync(logoPath).size < 500) {
    const url = "https://instagram.fgye5-3.fna.fbcdn.net/v/t51.82787-19/718993151_18100025014897859_6832355672655652043_n.jpg?stp=dst-jpg_s320x320_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fgye5-3.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gGDXezDQZEjAcDPlWPf7BEkUW-i4f-nqxzEx_lsITsUteh_41pHPeGk4DLXTR99BXtYMmWLF1LLRy08ALBdlgXj&_nc_ohc=SwAxnBoDhs8Q7kNvwFAjWPp&_nc_gid=8Vgjdfuh1V1hTLTGUT;8b3546";
    // We should use the user's latest stable URL or fallback if signature changes.
    const cleanUrl = "https://instagram.fgye5-3.fna.fbcdn.net/v/t51.82787-19/718993151_18100025014897859_6832355672655652043_n.jpg?stp=dst-jpg_s320x320_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fgye5-3.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gGDXezDQZEjAcDPlWPf7BEkUW-i4f-nqxzEx_lsITsUteh_41pHPeGk4DLXTR99BXtYMmWLF1LLRy08ALBdlgXj&_nc_ohc=SwAxnBoDhs8Q7kNvwFAjWPp&_nc_gid=8Vgjdfuh1V1hTLTGUTjAVg&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_Af8pD-SuJz-HfGz0G4GcbUYQ1c4-xJoXWIpUME1sO650DA&oe=6A3CEED1&_nc_sid=8b3546";
    
    const file = fs.createWriteStream(logoPath);
    https.get(cleanUrl, (res) => {
      if (res.statusCode === 200) {
        res.pipe(file);
      }
    }).on('error', () => {});
  }
} catch (e) {
  console.warn("Auto logo download bypassed:", e);
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || ''),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || ''),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
