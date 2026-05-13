import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    proxy: {
      "/api": process.env.AGENTICA_API_URL || "http://127.0.0.1:8797",
      "/live-projects": process.env.AGENTICA_API_URL || "http://127.0.0.1:8797"
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
