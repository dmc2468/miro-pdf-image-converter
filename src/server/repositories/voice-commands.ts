import type { Collection, Db } from "mongodb";
import { randomUUID } from "node:crypto";
import type { VoiceCommand, VoiceCommandActionType, VoiceCommandInput, VoiceCommandModifier, VoiceCommandTargetApp } from "../../shared/types.js";

export interface VoiceCommandRecord extends Omit<VoiceCommand, "createdAt" | "updatedAt"> {
  createdAt: Date;
  updatedAt: Date;
}

export interface VoiceCommandRepository {
  list(): Promise<VoiceCommandRecord[]>;
  findById(id: string): Promise<VoiceCommandRecord | null>;
  create(input: VoiceCommandInput): Promise<VoiceCommandRecord>;
  update(id: string, input: Partial<VoiceCommandInput>): Promise<VoiceCommandRecord | null>;
  delete(id: string): Promise<void>;
  replaceAll(commands: VoiceCommandInput[]): Promise<VoiceCommandRecord[]>;
  ensureIndexes(): Promise<void>;
  seedDefaults(): Promise<void>;
}

export interface NormalisedVoiceCommandInput extends VoiceCommandInput {
  id: string;
}

export const voiceCommandActionTypes: VoiceCommandActionType[] = ["shortcut", "macro", "script"];
export const voiceCommandTargetApps: VoiceCommandTargetApp[] = ["Vectorworks", "Vectorworks 2026", "Vectorworks 2025", "Miro", "Chrome", "Finder", "Other"];
export const voiceCommandModifiers: VoiceCommandModifier[] = ["command", "shift", "option", "control"];

const seedVoiceCommands: VoiceCommandInput[] = [
  {
    id: "vw-wall",
    enabled: true,
    voicePhrase: "wall",
    targetApp: "Vectorworks",
    actionType: "shortcut",
    key: "w",
    modifiers: [],
    macroName: "",
    notes: "Activates the Wall tool in Vectorworks",
  },
  {
    id: "vw-rectangle",
    enabled: true,
    voicePhrase: "rectangle",
    targetApp: "Vectorworks",
    actionType: "shortcut",
    key: "r",
    modifiers: [],
    macroName: "",
    notes: "Activates the Rectangle tool",
  },
  {
    id: "vw-top-plan",
    enabled: true,
    voicePhrase: "top plan",
    targetApp: "Vectorworks",
    actionType: "shortcut",
    key: "5",
    modifiers: ["command"],
    macroName: "",
    notes: "Switches to Top/Plan view",
  },
  {
    id: "vw-fit-objects",
    enabled: true,
    voicePhrase: "fit objects",
    targetApp: "Vectorworks",
    actionType: "shortcut",
    key: "6",
    modifiers: ["command"],
    macroName: "",
    notes: "Runs Fit to Objects or equivalent workspace shortcut",
  },
  {
    id: "vw-publish-pdf",
    enabled: true,
    voicePhrase: "publish pdf",
    targetApp: "Vectorworks",
    actionType: "shortcut",
    key: "p",
    modifiers: ["command", "shift"],
    macroName: "",
    notes: "Opens the Publish dialog",
  },
];

export function serializeVoiceCommand(command: VoiceCommandRecord): VoiceCommand {
  return {
    ...command,
    createdAt: command.createdAt.toISOString(),
    updatedAt: command.updatedAt.toISOString(),
  };
}

export function normaliseVoiceCommandInput(input: VoiceCommandInput): NormalisedVoiceCommandInput {
  return {
    id: input.id?.trim() || phraseId(input.voicePhrase),
    enabled: input.enabled,
    voicePhrase: input.voicePhrase.trim().toLowerCase(),
    targetApp: input.targetApp,
    actionType: input.actionType,
    key: input.key.trim(),
    modifiers: input.modifiers,
    macroName: input.macroName.trim(),
    notes: input.notes.trim(),
  };
}

export function isVoiceCommandActionType(value: string): value is VoiceCommandActionType {
  return voiceCommandActionTypes.includes(value as VoiceCommandActionType);
}

export function isVoiceCommandTargetApp(value: string): value is VoiceCommandTargetApp {
  return voiceCommandTargetApps.includes(value as VoiceCommandTargetApp);
}

export function isVoiceCommandModifier(value: string): value is VoiceCommandModifier {
  return voiceCommandModifiers.includes(value as VoiceCommandModifier);
}

export class MongoVoiceCommandRepository implements VoiceCommandRepository {
  private readonly collection: Collection<VoiceCommandRecord>;

  constructor(db: Db) {
    this.collection = db.collection<VoiceCommandRecord>("voiceCommands");
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ voicePhrase: 1 }, { unique: true });
    await this.collection.createIndex({ targetApp: 1 });
  }

  async seedDefaults(): Promise<void> {
    if (await this.collection.findOne({})) return;
    await this.replaceAll(seedVoiceCommands);
  }

  async list(): Promise<VoiceCommandRecord[]> {
    return this.collection.find({}).sort({ voicePhrase: 1 }).toArray();
  }

  async findById(id: string): Promise<VoiceCommandRecord | null> {
    return this.collection.findOne({ id });
  }

  async create(input: VoiceCommandInput): Promise<VoiceCommandRecord> {
    const now = new Date();
    const command: VoiceCommandRecord = {
      ...normaliseVoiceCommandInput(input),
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(command);
    return command;
  }

  async update(id: string, input: Partial<VoiceCommandInput>): Promise<VoiceCommandRecord | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const next = normaliseVoiceCommandInput({
      id,
      enabled: input.enabled ?? existing.enabled,
      voicePhrase: input.voicePhrase ?? existing.voicePhrase,
      targetApp: input.targetApp ?? existing.targetApp,
      actionType: input.actionType ?? existing.actionType,
      key: input.key ?? existing.key,
      modifiers: input.modifiers ?? existing.modifiers,
      macroName: input.macroName ?? existing.macroName,
      notes: input.notes ?? existing.notes,
    });
    await this.collection.updateOne({ id }, { $set: { ...next, updatedAt: new Date() } });
    return this.findById(next.id);
  }

  async delete(id: string): Promise<void> {
    await this.collection.deleteOne({ id });
  }

  async replaceAll(commands: VoiceCommandInput[]): Promise<VoiceCommandRecord[]> {
    await this.collection.deleteMany({});
    const now = new Date();
    const records = commands.map((input) => ({
      ...normaliseVoiceCommandInput(input),
      createdAt: now,
      updatedAt: now,
    }));
    if (records.length) await this.collection.insertMany(records);
    return this.list();
  }
}

export class MemoryVoiceCommandRepository implements VoiceCommandRepository {
  private readonly commands = new Map<string, VoiceCommandRecord>();

  async ensureIndexes(): Promise<void> {
    return undefined;
  }

  async seedDefaults(): Promise<void> {
    if (this.commands.size > 0) return;
    await this.replaceAll(seedVoiceCommands);
  }

  async list(): Promise<VoiceCommandRecord[]> {
    return [...this.commands.values()].sort((left, right) => left.voicePhrase.localeCompare(right.voicePhrase));
  }

  async findById(id: string): Promise<VoiceCommandRecord | null> {
    return this.commands.get(id) ?? null;
  }

  async create(input: VoiceCommandInput): Promise<VoiceCommandRecord> {
    const now = new Date();
    const command: VoiceCommandRecord = {
      ...normaliseVoiceCommandInput(input),
      createdAt: now,
      updatedAt: now,
    };
    this.commands.set(command.id, command);
    return command;
  }

  async update(id: string, input: Partial<VoiceCommandInput>): Promise<VoiceCommandRecord | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const next = normaliseVoiceCommandInput({
      id,
      enabled: input.enabled ?? existing.enabled,
      voicePhrase: input.voicePhrase ?? existing.voicePhrase,
      targetApp: input.targetApp ?? existing.targetApp,
      actionType: input.actionType ?? existing.actionType,
      key: input.key ?? existing.key,
      modifiers: input.modifiers ?? existing.modifiers,
      macroName: input.macroName ?? existing.macroName,
      notes: input.notes ?? existing.notes,
    });
    const command = { ...existing, ...next, updatedAt: new Date() };
    this.commands.delete(id);
    this.commands.set(command.id, command);
    return command;
  }

  async delete(id: string): Promise<void> {
    this.commands.delete(id);
  }

  async replaceAll(commands: VoiceCommandInput[]): Promise<VoiceCommandRecord[]> {
    this.commands.clear();
    for (const input of commands) await this.create(input);
    return this.list();
  }
}

function phraseId(voicePhrase: string): string {
  const suffix = voicePhrase.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return suffix ? `voice-${suffix}` : randomUUID();
}
