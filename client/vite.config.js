import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api requests are proxied to the Express server so the browser
// never needs to know its URL (and there are no CORS issues).
export default defineConfig({
  plugins: [react()],
  // One env file for the whole project: Vite exposes only the VITE_* variables in server/.env.
  envDir: '../server',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
