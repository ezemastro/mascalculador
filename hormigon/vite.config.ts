import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { execSync } from "node:child_process";

// Sello de build visible en la esquina inferior derecha de la app y en la
// consola: permite verificar de un vistazo si el navegador corrió la versión
// nueva o una cacheada. En Docker el .git puede no estar en el contexto.
function buildStamp(): string {
  let hash = "";
  try {
    hash = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    // sin git disponible: queda solo el timestamp
  }
  const ts = new Date().toISOString().replace("T", " ").slice(0, 16);
  return hash ? `${ts} (${hash})` : ts;
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_BUILD__: JSON.stringify(buildStamp()),
  },
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
