import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  build: {
    // По умолчанию Vite 8 собирает под Chrome 111+ / Safari 16.4+. Понижаем цель,
    // чтобы приложение запускалось и в необновлённых Chrome/WebView на Android
    target: ["es2019", "chrome73", "safari13", "firefox68", "edge79"]
  },
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(version)
  },
  test: {
    // у сервера групп свои тесты на встроенном node:test (cd server && npm test)
    exclude: ["**/node_modules/**", "server/**", "android/**", "dist/**"]
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
        // Заставки iOS не нужны в офлайн-кэше: iOS забирает их сам при установке
        globIgnores: ["splash/**"]
      },
      manifest: {
        id: "/",
        name: "Компас",
        short_name: "Компас",
        description: "Офлайн-компас с GPS: стрелка указывает на выбранную точку",
        lang: "ru",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone"],
        orientation: "any",
        theme_color: "#0d1820",
        background_color: "#0d1820",
        categories: ["navigation", "travel", "utilities"],
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      }
    })
  ]
});
