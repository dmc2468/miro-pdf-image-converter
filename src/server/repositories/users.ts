import type { Collection, Db } from "mongodb";
import { randomUUID } from "node:crypto";
import type { AdminUser, UserRole } from "../../shared/types.js";

export type UserRecord = {
  _id: string;
  email: string;
  name?: string;
  role: UserRole;
  passwordHash: string;
  magicLinkTokenHash?: string;
  magicLinkExpiresAt?: Date;
  magicLinkUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  findByMagicLinkHash(tokenHash: string): Promise<UserRecord | null>;
  list(): Promise<UserRecord[]>;
  create(input: { email: string; name?: string; passwordHash: string; role?: UserRole }): Promise<UserRecord>;
  update(input: { id: string; name?: string; role?: UserRole; passwordHash?: string }): Promise<UserRecord | null>;
  setMagicLink(input: { id: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  markMagicLinkUsed(id: string): Promise<void>;
  ensureIndexes(): Promise<void>;
}

export function serializeAdminUser(user: UserRecord): AdminUser {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export class MongoUserRepository implements UserRepository {
  private readonly collection: Collection<UserRecord>;

  constructor(db: Db) {
    this.collection = db.collection<UserRecord>("users");
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ email: 1 }, { unique: true });
    await this.collection.createIndex({ magicLinkTokenHash: 1 }, { sparse: true });
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.collection.findOne({ email: email.toLowerCase() });
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.collection.findOne({ _id: id });
  }

  async findByMagicLinkHash(tokenHash: string): Promise<UserRecord | null> {
    return this.collection.findOne({ magicLinkTokenHash: tokenHash });
  }

  async list(): Promise<UserRecord[]> {
    return this.collection.find({}).sort({ createdAt: -1 }).toArray();
  }

  async create(input: { email: string; name?: string; passwordHash: string; role?: UserRole }): Promise<UserRecord> {
    const now = new Date();
    const user: UserRecord = {
      _id: randomUUID(),
      email: input.email.toLowerCase(),
      name: input.name,
      role: input.role ?? "user",
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(user);
    return user;
  }

  async update(input: { id: string; name?: string; role?: UserRole; passwordHash?: string }): Promise<UserRecord | null> {
    await this.collection.updateOne(
      { _id: input.id },
      {
        $set: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.role ? { role: input.role } : {}),
          ...(input.passwordHash ? { passwordHash: input.passwordHash } : {}),
          updatedAt: new Date(),
        },
      },
    );
    return this.findById(input.id);
  }

  async setMagicLink(input: { id: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.collection.updateOne(
      { _id: input.id },
      {
        $set: {
          magicLinkTokenHash: input.tokenHash,
          magicLinkExpiresAt: input.expiresAt,
          updatedAt: new Date(),
        },
        $unset: {
          magicLinkUsedAt: "",
        },
      },
    );
  }

  async markMagicLinkUsed(id: string): Promise<void> {
    await this.collection.updateOne(
      { _id: id },
      {
        $set: {
          magicLinkUsedAt: new Date(),
          updatedAt: new Date(),
        },
        $unset: {
          magicLinkTokenHash: "",
          magicLinkExpiresAt: "",
        },
      },
    );
  }
}

export class MemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserRecord>();

  async ensureIndexes(): Promise<void> {
    return undefined;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.toLowerCase();
    return [...this.users.values()].find((user) => user.email === normalized) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async findByMagicLinkHash(tokenHash: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((user) => user.magicLinkTokenHash === tokenHash) ?? null;
  }

  async list(): Promise<UserRecord[]> {
    return [...this.users.values()].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async create(input: { email: string; name?: string; passwordHash: string; role?: UserRole }): Promise<UserRecord> {
    const existing = await this.findByEmail(input.email);
    if (existing) return existing;

    const now = new Date();
    const user: UserRecord = {
      _id: randomUUID(),
      email: input.email.toLowerCase(),
      name: input.name,
      role: input.role ?? "user",
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user._id, user);
    return user;
  }

  async update(input: { id: string; name?: string; role?: UserRole; passwordHash?: string }): Promise<UserRecord | null> {
    const user = await this.findById(input.id);
    if (!user) return null;
    if (input.name !== undefined) user.name = input.name;
    if (input.role) user.role = input.role;
    if (input.passwordHash) user.passwordHash = input.passwordHash;
    user.updatedAt = new Date();
    return user;
  }

  async setMagicLink(input: { id: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    const user = await this.findById(input.id);
    if (!user) return;
    user.magicLinkTokenHash = input.tokenHash;
    user.magicLinkExpiresAt = input.expiresAt;
    user.magicLinkUsedAt = undefined;
    user.updatedAt = new Date();
  }

  async markMagicLinkUsed(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) return;
    user.magicLinkTokenHash = undefined;
    user.magicLinkExpiresAt = undefined;
    user.magicLinkUsedAt = new Date();
    user.updatedAt = new Date();
  }
}
