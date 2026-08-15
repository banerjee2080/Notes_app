import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/serviceWorker",
      filename: "serviceWorker.js",
      registerType: "autoUpdate",
      // Enable this so you can test turning off your WiFi while running 'npm run dev'
      devOptions: {
        enabled: true,
        type: "module",
      },
      manifest: {
        name: "Enterprise Notes",
        short_name: "Notes",
        theme_color: "#000000", // Matches a dark mode / modern aesthetic
        background_color: "#000000",
        display: "standalone", // Makes it look like a native app (removes browser URL bar)
        icons: [
          {
            src: "favicon.svg", // Using your existing favicon
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "avatar.png", // Fallback icon using your avatar asset
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        maximumFileSizeToCacheInBytes: 5000000,
        rollupFormat: 'iife',
      },
    }),
  ],
});
