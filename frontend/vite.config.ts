import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Listen on all interfaces so ngrok / LAN devices can reach the dev server
    host: true,
    port: 5173,
    // Vite blocks unknown Host headers; ngrok uses *.ngrok-free.dev etc.
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.ngrok.app', '.inc1.devtunnels.ms'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          livekit: ['@livekit/components-react', 'livekit-client'],
          charts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
