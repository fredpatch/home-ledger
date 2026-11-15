import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// P1.6 dev approach: /api is proxied so the browser sees one origin (APP_ORIGIN=http://localhost:5173).
// The Origin header is forwarded unchanged (no changeOrigin) because the API checks it on mutations.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:3001" },
    },
  },
});
