import { config } from "./config.js";
import { createApp } from "./app.js";
import { createRepositories } from "./repositories/index.js";
import { createObjectStore } from "./storage/objectStore.js";
import { ensureDir } from "./utils/files.js";

async function main(): Promise<void> {
  await ensureDir(config.tempDir);
  const repositories = await createRepositories();
  const objectStore = await createObjectStore();
  const app = createApp(repositories, objectStore);

  const server = app.listen(config.port, () => {
    console.log(`[startup] Studio McLeod listening on ${config.port}`);
    console.log(`[startup] DB: ${config.mongoDbUri ? "MongoDB Atlas" : "in-memory"}`);
    console.log(`[startup] Storage: ${config.s3 ? "S3" : "local files"}`);
    console.log(`[startup] Frontend URL: ${config.frontendBaseUrl}`);
    console.log(`[startup] Seed user: ${config.seedUserEmail ?? "none"}`);
  });

  const shutdown = async () => {
    server.close();
    await repositories.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
