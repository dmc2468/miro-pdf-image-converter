import { config } from "./config.js";
import { createApp } from "./app.js";
import { createRepositories } from "./repositories/index.js";
import { createObjectStore } from "./storage/objectStore.js";
import { logger } from "./logger.js";
import { ensureDir } from "./utils/files.js";

async function main(): Promise<void> {
  await ensureDir(config.tempDir);
  const repositories = await createRepositories();
  const objectStore = await createObjectStore();
  const app = createApp(repositories, objectStore);

  const server = app.listen(config.port, () => {
    logger.info({
      port: config.port,
      database: config.mongoDbUri ? "MongoDB Atlas" : "in-memory",
      storage: config.s3 ? "S3" : "local files",
      frontendBaseUrl: config.frontendBaseUrl,
      seedUserEmail: config.seedUserEmail,
    }, "Studio McLeod listening");
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
  logger.fatal({ error }, "server startup failed");
  process.exit(1);
});
