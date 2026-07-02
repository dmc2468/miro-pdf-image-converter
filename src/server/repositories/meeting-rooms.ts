import type { Collection, Db } from "mongodb";
import type { MeetingRoom, MeetingRoomBoard, MeetingRoomId, MeetingRoomInput, MeetingRoomParticipant } from "../../shared/types.js";

export interface MeetingRoomRecord extends Omit<MeetingRoom, "createdAt" | "updatedAt"> {
  createdAt: Date;
  updatedAt: Date;
}

export interface MeetingRoomRepository {
  list(): Promise<MeetingRoomRecord[]>;
  findById(id: MeetingRoomId): Promise<MeetingRoomRecord | null>;
  update(id: MeetingRoomId, input: MeetingRoomInput): Promise<MeetingRoomRecord | null>;
  join(id: MeetingRoomId, participant: MeetingRoomParticipant): Promise<MeetingRoomRecord | null>;
  leave(id: MeetingRoomId, userId: string): Promise<MeetingRoomRecord | null>;
  shareBoard(id: MeetingRoomId, board: MeetingRoomBoard): Promise<MeetingRoomRecord | null>;
  clearBoard(id: MeetingRoomId): Promise<MeetingRoomRecord | null>;
  ensureIndexes(): Promise<void>;
  seedDefaults(): Promise<void>;
}

const seedMeetingRooms: Omit<MeetingRoomRecord, "createdAt" | "updatedAt">[] = [
  {
    id: "call-hangout-1",
    name: "Call Hangout 1",
    teamspeakChannelName: "Call Hangout 1",
    meetUrl: "",
    participants: [],
  },
  {
    id: "call-hangout-2",
    name: "Call Hangout 2",
    teamspeakChannelName: "Call Hangout 2",
    meetUrl: "",
    participants: [],
  },
  {
    id: "call-hangout-3",
    name: "Call Hangout 3",
    teamspeakChannelName: "Call Hangout 3",
    meetUrl: "",
    participants: [],
  },
];

export function serializeMeetingRoom(room: MeetingRoomRecord): MeetingRoom {
  return {
    ...room,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}

export class MongoMeetingRoomRepository implements MeetingRoomRepository {
  private readonly collection: Collection<MeetingRoomRecord>;

  constructor(db: Db) {
    this.collection = db.collection<MeetingRoomRecord>("meetingRooms");
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ id: 1 }, { unique: true });
  }

  async seedDefaults(): Promise<void> {
    const now = new Date();
    for (const room of seedMeetingRooms) {
      await this.collection.updateOne(
        { id: room.id },
        {
          $setOnInsert: {
            ...room,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    }
  }

  async list(): Promise<MeetingRoomRecord[]> {
    return this.collection.find({}).sort({ id: 1 }).toArray();
  }

  async findById(id: MeetingRoomId): Promise<MeetingRoomRecord | null> {
    return this.collection.findOne({ id });
  }

  async update(id: MeetingRoomId, input: MeetingRoomInput): Promise<MeetingRoomRecord | null> {
    await this.collection.updateOne({ id }, { $set: { meetUrl: input.meetUrl, updatedAt: new Date() } });
    return this.findById(id);
  }

  async join(id: MeetingRoomId, participant: MeetingRoomParticipant): Promise<MeetingRoomRecord | null> {
    const room = await this.findById(id);
    if (!room) return null;
    const participants = [participant, ...room.participants.filter((item) => item.userId !== participant.userId)];
    await this.collection.updateOne({ id }, { $set: { participants, updatedAt: new Date() } });
    return this.findById(id);
  }

  async leave(id: MeetingRoomId, userId: string): Promise<MeetingRoomRecord | null> {
    const room = await this.findById(id);
    if (!room) return null;
    await this.collection.updateOne(
      { id },
      {
        $set: {
          participants: room.participants.filter((item) => item.userId !== userId),
          updatedAt: new Date(),
        },
      },
    );
    return this.findById(id);
  }

  async shareBoard(id: MeetingRoomId, board: MeetingRoomBoard): Promise<MeetingRoomRecord | null> {
    await this.collection.updateOne({ id }, { $set: { miroBoard: board, updatedAt: new Date() } });
    return this.findById(id);
  }

  async clearBoard(id: MeetingRoomId): Promise<MeetingRoomRecord | null> {
    await this.collection.updateOne({ id }, { $unset: { miroBoard: "" }, $set: { updatedAt: new Date() } });
    return this.findById(id);
  }
}

export class MemoryMeetingRoomRepository implements MeetingRoomRepository {
  private readonly rooms = new Map<MeetingRoomId, MeetingRoomRecord>();

  async ensureIndexes(): Promise<void> {
    return undefined;
  }

  async seedDefaults(): Promise<void> {
    const now = new Date();
    for (const room of seedMeetingRooms) {
      const existing = this.rooms.get(room.id);
      if (!existing) {
        this.rooms.set(room.id, {
          ...room,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  async list(): Promise<MeetingRoomRecord[]> {
    return [...this.rooms.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  async findById(id: MeetingRoomId): Promise<MeetingRoomRecord | null> {
    return this.rooms.get(id) ?? null;
  }

  async update(id: MeetingRoomId, input: MeetingRoomInput): Promise<MeetingRoomRecord | null> {
    const room = await this.findById(id);
    if (!room) return null;
    room.meetUrl = input.meetUrl;
    room.updatedAt = new Date();
    return room;
  }

  async join(id: MeetingRoomId, participant: MeetingRoomParticipant): Promise<MeetingRoomRecord | null> {
    const room = await this.findById(id);
    if (!room) return null;
    room.participants = [participant, ...room.participants.filter((item) => item.userId !== participant.userId)];
    room.updatedAt = new Date();
    return room;
  }

  async leave(id: MeetingRoomId, userId: string): Promise<MeetingRoomRecord | null> {
    const room = await this.findById(id);
    if (!room) return null;
    room.participants = room.participants.filter((item) => item.userId !== userId);
    room.updatedAt = new Date();
    return room;
  }

  async shareBoard(id: MeetingRoomId, board: MeetingRoomBoard): Promise<MeetingRoomRecord | null> {
    const room = await this.findById(id);
    if (!room) return null;
    room.miroBoard = board;
    room.updatedAt = new Date();
    return room;
  }

  async clearBoard(id: MeetingRoomId): Promise<MeetingRoomRecord | null> {
    const room = await this.findById(id);
    if (!room) return null;
    room.miroBoard = undefined;
    room.updatedAt = new Date();
    return room;
  }
}
