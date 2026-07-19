import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Enable this so you can test turning off your WiFi while running 'npm run dev'
      devOptions: {
        enabled: true,
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
      workbox: {
        // This is the most critical line for Path 2.
        // It tells the Service Worker to aggressively cache all UI assets.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}", "tinymce/**/*"],
        maximumFileSizeToCacheInBytes: 5000000, // 5MB to ensure TinyMCE files are cached
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // This regex must match your backend's save/update endpoint
            urlPattern: /\/api\/notes\/upsert/,
            handler: "NetworkOnly", // Only attempt network, fail to queue if offline
            method: "POST",
            options: {
              backgroundSync: {
                name: "notes-sync-queue",
                options: {
                  maxRetentionTime: 24 * 60, // Retain the failed request for up to 24 hours
                },
              },
            },
          },
        ],
      },
    }),
  ],
});
