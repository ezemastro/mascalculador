import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5174,
    allowedHosts: true,
    proxy: {
      "/api": "http://127.0.0.1:5177",
      "/health": "http://127.0.0.1:5177",
    },
  },
  resolve: {
    alias: {
      "@mascalculador/shared": path.resolve(__dirname, "shared/src"),
    },
  },
});
