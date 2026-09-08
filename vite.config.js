import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.js', '**/*.css', '**/*.html', '**/*.ico', '**/*.png', '**/*.svg']
      },
      manifest: {
        name: 'My Compass',
        short_name: 'Compass',
        theme_color: '#ffffff',
        display: 'standalone'
      }
    })
  ]
});
