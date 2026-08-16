import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 5175, allowedHosts: true },
  resolve: {
    alias: {
      "@mascalculador/shared": path.resolve(__dirname, "shared/src"),
    },
  },
});
