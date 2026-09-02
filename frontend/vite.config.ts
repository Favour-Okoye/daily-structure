import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/daily-structure/",
  // MoneyTree runs on 5173/4173; keep both apps runnable at once.
  // host: true → listen on IPv4 + IPv6 so every browser's "localhost" connects.
  server: { port: 5174, host: true },
  preview: { port: 4174, host: true },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "Daily Structure — your day is a voyage",
        short_name: "Daily",
        description: "Anchors, tasks, and the crew that keeps Favour honest.",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#FFF9EF",
        theme_color: "#0c4a6e",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/daily-structure/index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
    }),
  ],
});
