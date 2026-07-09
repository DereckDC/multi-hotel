// Fallback for static environments without a dynamic Node.js server.
// In static hosting (like Vercel), this file is served directly.
// The app will automatically fall back to Vite's build-time environment variables or defaults.
if (typeof window !== 'undefined' && !window.__SUPABASE_ENV__) {
  window.__SUPABASE_ENV__ = {
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_ANON_KEY: ""
  };
}
