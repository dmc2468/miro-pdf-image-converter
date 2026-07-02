import type { Collection, Db } from "mongodb";
import type { MeetingRoomId, TeamSpeakBridgeStatus } from "../../shared/types.js";

export interface TeamSpeakBridgeStatusRecord extends Omit<TeamSpeakBridgeStatus, "lastSeenAt"> {
  lastSeenAt: Date;
}

export interface TeamSpeakBridgeStatusInput {
  userId: string;
  email: string;
  name?: string;
  channelName?: string;
  activeRoomId?: MeetingRoomId;
}

export interface TeamSpeakBridgeRepository {
  list(): Promise<TeamSpeakBridgeStatusRecord[]>;
  update(input: TeamSpeakBridgeStatusInput): Promise<TeamSpeakBridgeStatusRecord>;
  ensureIndexes(): Promise<void>;
}

export function serializeTeamSpeakBridgeStatus(status: TeamSpeakBridgeStatusRecord): TeamSpeakBridgeStatus {
  return {
    ...status,
    lastSeenAt: status.lastSeenAt.toISOString(),
  };
}

export class MongoTeamSpeakBridgeRepository implements TeamSpeakBridgeRepository {
  private readonly collection: Collection<TeamSpeakBridgeStatusRecord>;

  constructor(db: Db) {
    this.collection = db.collection<TeamSpeakBridgeStatusRecord>("teamSpeakBridgeStatuses");
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ userId: 1 }, { unique: true });
  }

  async list(): Promise<TeamSpeakBridgeStatusRecord[]> {
    return this.collection.find({}).sort({ lastSeenAt: -1 }).toArray();
  }

  async update(input: TeamSpeakBridgeStatusInput): Promise<TeamSpeakBridgeStatusRecord> {
    const status: TeamSpeakBridgeStatusRecord = {
      userId: input.userId,
      email: input.email,
      lastSeenAt: new Date(),
    };
    if (input.name !== undefined) status.name = input.name;
    if (input.channelName !== undefined) status.channelName = input.channelName;
    if (input.activeRoomId !== undefined) status.activeRoomId = input.activeRoomId;
    await this.collection.replaceOne({ userId: input.userId }, status, { upsert: true });
    return status;
  }
}

export class MemoryTeamSpeakBridgeRepository implements TeamSpeakBridgeRepository {
  private readonly statuses = new Map<string, TeamSpeakBridgeStatusRecord>();

  async ensureIndexes(): Promise<void> {
    return undefined;
  }

  async list(): Promise<TeamSpeakBridgeStatusRecord[]> {
    return [...this.statuses.values()].sort((left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime());
  }

  async update(input: TeamSpeakBridgeStatusInput): Promise<TeamSpeakBridgeStatusRecord> {
    const status: TeamSpeakBridgeStatusRecord = {
      userId: input.userId,
      email: input.email,
      lastSeenAt: new Date(),
    };
    if (input.name !== undefined) status.name = input.name;
    if (input.channelName !== undefined) status.channelName = input.channelName;
    if (input.activeRoomId !== undefined) status.activeRoomId = input.activeRoomId;
    this.statuses.set(input.userId, status);
    return status;
  }
}
