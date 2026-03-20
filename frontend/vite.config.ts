import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3000,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // PWA disabled in build to avoid "Unexpected early exit" from workbox/terser; enable when fixed upstream
    mode !== "production" &&
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "robots.txt"],
        manifest: {
          name: "CacheTask - Employee Performance",
          short_name: "CacheTask",
          description: "Employee performance management and task tracking app",
          theme_color: "#6366f1",
          background_color: "#0f172a",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        },
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
