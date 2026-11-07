import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Defaults to the documented backend port. Set VITE_API_PROXY_TARGET to point the
// dev server at a different backend (for example when port 8000 is already in use).
const apiTarget = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
