// Fallback for static environments without a dynamic Node.js server.
// In static hosting (like Vercel), this file is served directly.
// The app will automatically fall back to Vite's build-time environment variables or defaults.
if (typeof window !== 'undefined' && !window.__SUPABASE_ENV__) {
  window.__SUPABASE_ENV__ = {
    VITE_SUPABASE_URL: "https://fyreapnukipdvcebvokj.supabase.co/rest/v1/",
    VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5cmVhcG51a2lwZHZjZWJ2b2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1OTcwMTIsImV4cCI6MjEwMDE3MzAxMn0.diZTbHx-8jDDGSJEG34ae1-HD-i_PLY-RWsCQUxlNAU"
  };
}
