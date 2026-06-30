import { MongoClient } from "mongodb";
import { config } from "../config.js";
import { hashPassword, verifyPassword } from "../auth.js";
import { MemoryJobRepository, MongoJobRepository, type JobRepository } from "./jobs.js";
import { MemoryUserRepository, MongoUserRepository, type UserRepository } from "./users.js";

export type Repositories = {
  users: UserRepository;
  jobs: JobRepository;
  close: () => Promise<void>;
};

export async function createRepositories(): Promise<Repositories> {
  let users: UserRepository;
  let jobs: JobRepository;
  let close: () => Promise<void> = async () => undefined;

  if (config.mongoDbUri) {
    const client = new MongoClient(config.mongoDbUri);
    await client.connect();
    const db = client.db(config.mongoDbName);
    users = new MongoUserRepository(db);
    jobs = new MongoJobRepository(db);
    close = async () => client.close();
  } else {
    users = new MemoryUserRepository();
    jobs = new MemoryJobRepository();
  }

  await users.ensureIndexes();
  await jobs.ensureIndexes();

  if (config.seedUserEmail && config.seedUserPassword) {
    const existing = await users.findByEmail(config.seedUserEmail);
    if (!existing) {
      await users.create({
        email: config.seedUserEmail,
        name: config.seedUserName,
        passwordHash: await hashPassword(config.seedUserPassword),
        role: "admin",
      });
    } else {
      const shouldUpdatePassword = config.nodeEnv !== "production" && !(await verifyPassword(config.seedUserPassword, existing.passwordHash));
      if (existing.role !== "admin" || (config.seedUserName !== undefined && existing.name !== config.seedUserName) || shouldUpdatePassword) {
        await users.update({
          id: existing._id,
          name: config.seedUserName,
          passwordHash: shouldUpdatePassword ? await hashPassword(config.seedUserPassword) : undefined,
          role: "admin",
        });
      }
    }
  }

  return { users, jobs, close };
}
