import type { Collection, Db } from "mongodb";
import type { MeetingRoomId, TeamSpeakBridgeStatus } from "../../shared/types.js";

export interface TeamSpeakBridgeStatusRecord extends Omit<TeamSpeakBridgeStatus, "lastSeenAt"> {
  lastSeenAt: Date;
}

export interface TeamSpeakBridgeStatusInput {
  userId: string;
  email: string;
  bridgeVersion?: string;
  errorMessage?: string | null;
  name?: string;
  channelName?: string;
  activeRoomId?: MeetingRoomId | null;
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
    const existing = await this.collection.findOne({ userId: input.userId });
    const status: TeamSpeakBridgeStatusRecord = {
      userId: input.userId,
      email: input.email,
      bridgeVersion: input.bridgeVersion ?? existing?.bridgeVersion,
      channelName: existing?.channelName,
      errorMessage: existing?.errorMessage,
      activeRoomId: existing?.activeRoomId,
      lastSeenAt: new Date(),
    };
    if (input.name !== undefined) status.name = input.name;
    else if (existing?.name !== undefined) status.name = existing.name;
    if (input.channelName !== undefined) status.channelName = input.channelName;
    if (input.errorMessage !== undefined) {
      if (input.errorMessage === null) delete status.errorMessage;
      else status.errorMessage = input.errorMessage;
    }
    if (input.activeRoomId !== undefined) {
      if (input.activeRoomId === null) delete status.activeRoomId;
      else status.activeRoomId = input.activeRoomId;
    }
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
    const existing = this.statuses.get(input.userId);
    const status: TeamSpeakBridgeStatusRecord = {
      userId: input.userId,
      email: input.email,
      bridgeVersion: input.bridgeVersion ?? existing?.bridgeVersion,
      channelName: existing?.channelName,
      errorMessage: existing?.errorMessage,
      activeRoomId: existing?.activeRoomId,
      lastSeenAt: new Date(),
    };
    if (input.name !== undefined) status.name = input.name;
    else if (existing?.name !== undefined) status.name = existing.name;
    if (input.channelName !== undefined) status.channelName = input.channelName;
    if (input.errorMessage !== undefined) {
      if (input.errorMessage === null) delete status.errorMessage;
      else status.errorMessage = input.errorMessage;
    }
    if (input.activeRoomId !== undefined) {
      if (input.activeRoomId === null) delete status.activeRoomId;
      else status.activeRoomId = input.activeRoomId;
    }
    this.statuses.set(input.userId, status);
    return status;
  }
}
