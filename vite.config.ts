import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  clearScreen: false,

  server: {
    host: host || false,
    port: 1420,
    strictPort: true,
    hmr: host
      ? {
        protocol: "ws",
        host: host,
        port: 1421,
      }
      : undefined,
  },

  envPrefix: ["VITE_", "TAURI_"],

  build: {
    target: ["es2021", "chrome100", "safari13"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("commonjsHelpers") || id.includes("commonjsHelper")) {
            return "vendor-helpers";
          }

          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "vendor-react";
          }

          if (
            id.includes("node_modules/i18next") ||
            id.includes("node_modules/react-i18next") ||
            id.includes("node_modules/i18next-browser-languagedetector")
          ) {
            return "vendor-i18n";
          }

          if (id.includes("@tauri-apps/")) {
            return "vendor-tauri";
          }

          if (id.includes("node_modules/framer-motion")) {
            return "vendor-framer";
          }

          // UI/Icons
          if (
            id.includes("node_modules/lucide-react") ||
            id.includes("node_modules/clsx") ||
            id.includes("node_modules/tailwind-merge")
          ) {
            return "vendor-ui";
          }

          if (id.includes("node_modules/zod")) {
            return "vendor-utils";
          }

          if (id.includes("node_modules/")) {
            return "vendor";
          }
        },

        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});