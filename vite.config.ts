import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

// Enable bundle visualizer when building (or when ANALYZE=1).
// Outputs dist/bundle-stats.html (treemap) for CI to upload on size-guard failure.
const ENABLE_VISUALIZER =
  process.env.ANALYZE === "1" || process.env.NODE_ENV === "production";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      // Disable SW in dev so it never interferes with the Lovable preview iframe
      devOptions: {
        enabled: false,
      },
      includeAssets: ["favicon.png", "robots.txt"],
      manifest: {
        name: "TaskHive – Trusted Home Services",
        short_name: "TaskHive",
        description:
          "Book trusted handyman professionals in minutes. AI-powered matching for on-demand home services.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#00272c",
        background_color: "#f7f9f7",
        lang: "en",
        categories: ["business", "lifestyle", "productivity"],
        shortcuts: [
          {
            name: "Browse services",
            short_name: "Browse",
            description: "Find a professional near you",
            url: "/browse",
            icons: [{ src: "/favicon.png", sizes: "192x192" }],
          },
          {
            name: "Post a task",
            short_name: "Post",
            description: "Get quotes from trusted pros",
            url: "/post-task",
            icons: [{ src: "/favicon.png", sizes: "192x192" }],
          },
          {
            name: "My bookings",
            short_name: "Bookings",
            description: "View your bookings",
            url: "/client-dashboard",
            icons: [{ src: "/favicon.png", sizes: "192x192" }],
          },
          {
            name: "Messages",
            short_name: "Chat",
            description: "Open chat",
            url: "/notifications",
            icons: [{ src: "/favicon.png", sizes: "192x192" }],
          },
        ],
        icons: [
          {
            src: "/favicon.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/favicon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/favicon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Never cache OAuth or Supabase auth callback paths
        navigateFallbackDenylist: [/^\/~oauth/, /^\/auth\//, /^\/api\//],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
        // Don't try to precache huge bundles
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Bring in custom push + background-sync handlers
        importScripts: ["/push-sw.js"],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          // HTML navigations — NetworkFirst so users always see fresh shell
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          // Supabase REST GETs — offline read fallback
          {
            urlPattern: ({ url, request }) =>
              request.method === "GET" && /\/rest\/v1\//.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Background Sync: queue mutating Supabase calls when offline
          {
            urlPattern: ({ url, request }) =>
              ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
              /\/rest\/v1\//.test(url.pathname),
            handler: "NetworkOnly",
            method: "POST",
            options: {
              backgroundSync: {
                name: "supabase-write-queue",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
        ],
      },
    }),
    ENABLE_VISUALIZER &&
      visualizer({
        filename: "dist/bundle-stats.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
        sourcemap: false,
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
