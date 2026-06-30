import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "src/client",
  css: {
    postcss: "./postcss.config.mjs",
  },
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        configure: (proxy) => {
          proxy.on("error", (err) => {
            const nodeErr = err as NodeJS.ErrnoException;
            if (nodeErr.code === "ECONNREFUSED" || nodeErr.code === "ECONNRESET") {
              return;
            }
          });
        },
      },
      "/health": {
        target: "http://localhost:8080",
        configure: (proxy) => {
          proxy.on("error", (err) => {
            const nodeErr = err as NodeJS.ErrnoException;
            if (nodeErr.code === "ECONNREFUSED" || nodeErr.code === "ECONNRESET") {
              return;
            }
          });
        },
      },
    },
  },
});
