// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react-swc";
// import path from "path";
// import { componentTagger } from "lovable-tagger";
// import { VitePWA } from "vite-plugin-pwa";

// export default defineConfig(({ mode }) => ({
//   server: {
//     host: "::",
//     port: 8080,
//     hmr: {
//       overlay: false,
//     },
//   },
//   plugins: [
//     react(),
//     mode === "development" && componentTagger(),
//     // Register Service Worker only in production builds
//     mode === "production" && VitePWA({
//       registerType: 'autoUpdate',
//       strategies: 'injectManifest',
//       srcDir: 'public',
//       filename: 'sw.js',
//       injectManifest: {
//         injectionPoint: undefined,
//       },
//       manifest: false, // Don't generate manifest automatically
//       devOptions: {
//         enabled: false,
//         type: 'module',
//       },
//     })
//   ].filter(Boolean),
//   resolve: {
//     alias: {
//       "@": path.resolve(__dirname, "./src"),
//     },
//   },
// }));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

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
    // Register Service Worker only in production builds
    mode === "production" && VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectManifest: {
        injectionPoint: undefined,
      },
      manifest: false, // Don't generate manifest automatically
      devOptions: {
        enabled: false,
        type: 'module',
      },
      // ✅ CRITICAL: Prevent Vite PWA from caching HTML navigation requests
      workbox: {
        navigateFallback: undefined,
        globPatterns: ['**/*.{js,css,ico,png,svg,webp,woff,woff2,ttf,eot}'],
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
}));