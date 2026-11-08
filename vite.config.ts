import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: null,
      registerType: "prompt",
      includeAssets: [
        "wine-words-icon-192.png",
        "wine-words-icon-512.png",
        "wine-words-icon-maskable-512.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "Wine Words",
        short_name: "Wine Words",
        description: "Wine reviews, articles, tasting tools and learning.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#fffaf4",
        theme_color: "#681a2a",
        icons: [
          {
            src: "/wine-words-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/wine-words-icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/wine-words-icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /\/api\/v1(?:\/|$)/],
        runtimeCaching: [],
        importScripts: ["/push-handlers.js"],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    include: ["src/**/*.{test,spec}.{js,mjs,jsx,ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/*.d.ts",
        "src/setupTests.ts",
        "src/main.tsx",
      ],
    },
  },
  // Bind all IPv4 interfaces explicitly (not `host: true`). On macOS, `host: true`
  // let Node bind only one address family at a time — sometimes IPv6 `::` only,
  // which left IPv4 LAN requests (e.g. a phone hitting http://<mac-ip>:5173)
  // timing out. `0.0.0.0` deterministically serves 127.0.0.1 and every LAN
  // interface. The `/api` proxy below keeps API calls same-origin, so a phone on
  // the LAN no longer needs CORS entries or a hard-coded API host.
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
});
