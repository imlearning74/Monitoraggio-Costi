import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Il base deve corrispondere al nome della repository su GitHub
  base: '/Monitoraggio-Costi/',
  plugins: [react()],
  define: {
    'process.env': {
      API_KEY: JSON.stringify(process.env.API_KEY || ''),
      SUPABASE_URL: JSON.stringify(process.env.SUPABASE_URL || ''),
      SUPABASE_ANON_KEY: JSON.stringify(process.env.SUPABASE_ANON_KEY || '')
    }
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
  }
});
