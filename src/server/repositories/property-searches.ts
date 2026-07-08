import type { Collection, Db } from "mongodb";
import { randomUUID } from "node:crypto";
import type { PropertyConstraintsReport, PropertySearchRecord, PropertySearchStatus } from "../../shared/property-constraints.js";

export interface PropertySearchRepositoryRecord extends Omit<PropertySearchRecord, "createdAt" | "updatedAt"> {
  createdAt: Date;
  updatedAt: Date;
}

export interface PropertySearchRepository {
  create(input: { userId: string; report: PropertyConstraintsReport }): Promise<PropertySearchRepositoryRecord>;
  listForUser(userId: string, status?: PropertySearchStatus, query?: string): Promise<PropertySearchRepositoryRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<PropertySearchRepositoryRecord | null>;
  promoteToActiveProject(id: string, userId: string, projectNumber: string): Promise<PropertySearchRepositoryRecord | null>;
  ensureIndexes(): Promise<void>;
}

export function serializePropertySearch(record: PropertySearchRepositoryRecord): PropertySearchRecord {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class MongoPropertySearchRepository implements PropertySearchRepository {
  private readonly collection: Collection<PropertySearchRepositoryRecord>;

  constructor(db: Db) {
    this.collection = db.collection<PropertySearchRepositoryRecord>("propertySearches");
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ userId: 1, status: 1, updatedAt: -1 });
    await this.collection.createIndex({ userId: 1, clientName: 1 });
    await this.collection.createIndex({ userId: 1, propertyAddress: 1 });
    await this.collection.createIndex({ userId: 1, projectReference: 1 });
    await this.collection.createIndex({ userId: 1, projectNumber: 1 });
  }

  async create(input: { userId: string; report: PropertyConstraintsReport }): Promise<PropertySearchRepositoryRecord> {
    const now = new Date();
    const record: PropertySearchRepositoryRecord = {
      id: randomUUID(),
      userId: input.userId,
      clientName: input.report.client.client_name,
      propertyAddress: input.report.property.input_address,
      postcode: input.report.property.postcode ?? "",
      projectReference: input.report.client.project_reference,
      status: "saved_search",
      report: input.report,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(record);
    return record;
  }

  async listForUser(userId: string, status?: PropertySearchStatus, query?: string): Promise<PropertySearchRepositoryRecord[]> {
    const filters = searchFilters(userId, status, query);
    return this.collection.find(filters).sort({ updatedAt: -1 }).limit(100).toArray();
  }

  async findByIdForUser(id: string, userId: string): Promise<PropertySearchRepositoryRecord | null> {
    return this.collection.findOne({ id, userId });
  }

  async promoteToActiveProject(id: string, userId: string, projectNumber: string): Promise<PropertySearchRepositoryRecord | null> {
    await this.collection.updateOne(
      { id, userId },
      {
        $set: {
          status: "active_project",
          projectNumber,
          updatedAt: new Date(),
        },
      },
    );
    return this.findByIdForUser(id, userId);
  }
}

export class MemoryPropertySearchRepository implements PropertySearchRepository {
  private readonly records = new Map<string, PropertySearchRepositoryRecord>();

  async ensureIndexes(): Promise<void> {
    return undefined;
  }

  async create(input: { userId: string; report: PropertyConstraintsReport }): Promise<PropertySearchRepositoryRecord> {
    const now = new Date();
    const record: PropertySearchRepositoryRecord = {
      id: randomUUID(),
      userId: input.userId,
      clientName: input.report.client.client_name,
      propertyAddress: input.report.property.input_address,
      postcode: input.report.property.postcode ?? "",
      projectReference: input.report.client.project_reference,
      status: "saved_search",
      report: input.report,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(record.id, record);
    return record;
  }

  async listForUser(userId: string, status?: PropertySearchStatus, query?: string): Promise<PropertySearchRepositoryRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.userId === userId)
      .filter((record) => status === undefined || record.status === status)
      .filter((record) => matchesQuery(record, query))
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .slice(0, 100);
  }

  async findByIdForUser(id: string, userId: string): Promise<PropertySearchRepositoryRecord | null> {
    const record = this.records.get(id);
    return record?.userId === userId ? record : null;
  }

  async promoteToActiveProject(id: string, userId: string, projectNumber: string): Promise<PropertySearchRepositoryRecord | null> {
    const record = await this.findByIdForUser(id, userId);
    if (!record) return null;
    record.status = "active_project";
    record.projectNumber = projectNumber;
    record.updatedAt = new Date();
    return record;
  }
}

function searchFilters(userId: string, status?: PropertySearchStatus, query?: string): Record<string, unknown> {
  const trimmed = query?.trim();
  const base: Record<string, unknown> = {
    userId,
    ...(status ? { status } : {}),
  };
  if (!trimmed) return base;
  const expression = new RegExp(escapeRegExp(trimmed), "i");
  return {
    ...base,
    $or: [
      { clientName: expression },
      { propertyAddress: expression },
      { postcode: expression },
      { projectReference: expression },
      { projectNumber: expression },
    ],
  };
}

function matchesQuery(record: PropertySearchRepositoryRecord, query?: string): boolean {
  const trimmed = query?.trim().toLowerCase();
  if (!trimmed) return true;
  return [
    record.clientName,
    record.propertyAddress,
    record.postcode,
    record.projectReference,
    record.projectNumber,
  ].filter((value): value is string => value !== undefined).some((value) => value.toLowerCase().includes(trimmed));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
