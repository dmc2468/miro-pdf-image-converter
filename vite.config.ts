import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function fullReloadOnSessionNoteChanges(): Plugin {
  const sessionsDir = path.resolve("sessions");
  return {
    name: "full-reload-on-session-note-changes",
    apply: "serve",
    configureServer(server) {
      server.watcher.add(sessionsDir);
      server.watcher.on("all", (_event, changedPath) => {
        if (changedPath.startsWith(sessionsDir) && changedPath.endsWith(".md")) {
          server.config.logger.info(`session note changed, reloading page: ${path.basename(changedPath)}`, { timestamp: true });
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), fullReloadOnSessionNoteChanges()],
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
    watch: {
      usePolling: true,
      interval: 300,
    },
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
