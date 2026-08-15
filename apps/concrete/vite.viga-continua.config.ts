import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Build standalone de Viga Continua (sin el resto de Estructuras de Hormigón).
// Se usa para el deploy independiente vía docker-compose (servicio viga-continua).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist-viga-continua",
    rollupOptions: {
      input: path.resolve(__dirname, "viga-continua.html"),
    },
  },
  resolve: {
    alias: {
      "@mascalculador/shared": path.resolve(
        __dirname,
        "../../packages/shared/src",
      ),
    },
  },
});
