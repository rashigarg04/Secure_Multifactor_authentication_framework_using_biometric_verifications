import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Use "localhost" (not 127.0.0.1) so it matches RP_ID=localhost for WebAuthn.
    host: "localhost",
    port: 5173,
    strictPort: true,
    proxy: {
      // The browser talks to http://localhost:5173/api/... and Vite forwards it
      // to Express. Same origin means no CORS or cookie headaches in development.
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: false,
      },
    },
  },
});