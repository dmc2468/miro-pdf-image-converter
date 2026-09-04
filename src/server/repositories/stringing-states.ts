import type { Collection, Db } from "mongodb";
import type { StringingState } from "../../shared/stringing.js";

export interface StringingStateRecord {
  userId: string;
  state: StringingState;
  updatedAt: Date;
}

export interface StringingStateRepository {
  findForUser(userId: string): Promise<StringingStateRecord | null>;
  saveForUser(userId: string, state: StringingState): Promise<StringingStateRecord>;
  ensureIndexes(): Promise<void>;
}

export class MongoStringingStateRepository implements StringingStateRepository {
  private readonly collection: Collection<StringingStateRecord>;

  constructor(db: Db) {
    this.collection = db.collection<StringingStateRecord>("stringingStates");
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ userId: 1 }, { unique: true });
  }

  async findForUser(userId: string): Promise<StringingStateRecord | null> {
    return this.collection.findOne({ userId });
  }

  async saveForUser(userId: string, state: StringingState): Promise<StringingStateRecord> {
    const updatedAt = new Date();
    await this.collection.updateOne({ userId }, { $set: { state, updatedAt } }, { upsert: true });
    return { userId, state, updatedAt };
  }
}

export class MemoryStringingStateRepository implements StringingStateRepository {
  private readonly records = new Map<string, StringingStateRecord>();

  async ensureIndexes(): Promise<void> {
    return undefined;
  }

  async findForUser(userId: string): Promise<StringingStateRecord | null> {
    return this.records.get(userId) ?? null;
  }

  async saveForUser(userId: string, state: StringingState): Promise<StringingStateRecord> {
    const record = { userId, state, updatedAt: new Date() };
    this.records.set(userId, record);
    return record;
  }
}
