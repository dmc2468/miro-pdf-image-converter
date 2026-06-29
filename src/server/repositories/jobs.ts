import type { Collection, Db } from "mongodb";
import { randomUUID } from "node:crypto";
import type { ConversionJob, DrawingScale, JobStatus, Orientation, PaperSize, StoredObject } from "../../shared/types.js";

export type JobRecord = Omit<ConversionJob, "createdAt" | "updatedAt" | "completedAt"> & {
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
};

export interface JobRepository {
  create(input: {
    userId: string;
    paperSize: PaperSize;
    orientation: Orientation;
    drawingScale: DrawingScale;
    targetPixelWidth: number;
  }): Promise<JobRecord>;
  updateStatus(id: string, userId: string, status: JobStatus, errorMessage?: string): Promise<void>;
  updateFiles(id: string, userId: string, files: { sourceFiles?: StoredObject[]; generatedImages?: StoredObject[]; zipFile?: StoredObject }): Promise<void>;
  findByIdForUser(id: string, userId: string): Promise<JobRecord | null>;
  listForUser(userId: string): Promise<JobRecord[]>;
  ensureIndexes(): Promise<void>;
}

export function serializeJob(job: JobRecord): ConversionJob {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt?.toISOString(),
  };
}

export class MongoJobRepository implements JobRepository {
  private readonly collection: Collection<JobRecord>;

  constructor(db: Db) {
    this.collection = db.collection<JobRecord>("conversionJobs");
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ userId: 1, createdAt: -1 });
    await this.collection.createIndex({ status: 1 });
  }

  async create(input: {
    userId: string;
    paperSize: PaperSize;
    orientation: Orientation;
    drawingScale: DrawingScale;
    targetPixelWidth: number;
  }): Promise<JobRecord> {
    const now = new Date();
    const job: JobRecord = {
      _id: randomUUID(),
      userId: input.userId,
      status: "pending",
      paperSize: input.paperSize,
      orientation: input.orientation,
      drawingScale: input.drawingScale,
      targetPixelWidth: input.targetPixelWidth,
      sourceFiles: [],
      generatedImages: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(job);
    return job;
  }

  async updateStatus(id: string, userId: string, status: JobStatus, errorMessage?: string): Promise<void> {
    const now = new Date();
    await this.collection.updateOne(
      { _id: id, userId },
      {
        $set: {
          status,
          errorMessage,
          updatedAt: now,
          ...(status === "completed" ? { completedAt: now } : {}),
        },
      },
    );
  }

  async updateFiles(id: string, userId: string, files: { sourceFiles?: StoredObject[]; generatedImages?: StoredObject[]; zipFile?: StoredObject }): Promise<void> {
    await this.collection.updateOne(
      { _id: id, userId },
      {
        $set: {
          ...files,
          updatedAt: new Date(),
        },
      },
    );
  }

  async findByIdForUser(id: string, userId: string): Promise<JobRecord | null> {
    return this.collection.findOne({ _id: id, userId });
  }

  async listForUser(userId: string): Promise<JobRecord[]> {
    return this.collection.find({ userId }).sort({ createdAt: -1 }).limit(50).toArray();
  }
}

export class MemoryJobRepository implements JobRepository {
  private readonly jobs = new Map<string, JobRecord>();

  async ensureIndexes(): Promise<void> {
    return undefined;
  }

  async create(input: {
    userId: string;
    paperSize: PaperSize;
    orientation: Orientation;
    drawingScale: DrawingScale;
    targetPixelWidth: number;
  }): Promise<JobRecord> {
    const now = new Date();
    const job: JobRecord = {
      _id: randomUUID(),
      userId: input.userId,
      status: "pending",
      paperSize: input.paperSize,
      orientation: input.orientation,
      drawingScale: input.drawingScale,
      targetPixelWidth: input.targetPixelWidth,
      sourceFiles: [],
      generatedImages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job._id, job);
    return job;
  }

  async updateStatus(id: string, userId: string, status: JobStatus, errorMessage?: string): Promise<void> {
    const job = await this.findByIdForUser(id, userId);
    if (!job) return;
    job.status = status;
    job.errorMessage = errorMessage;
    job.updatedAt = new Date();
    if (status === "completed") job.completedAt = job.updatedAt;
  }

  async updateFiles(id: string, userId: string, files: { sourceFiles?: StoredObject[]; generatedImages?: StoredObject[]; zipFile?: StoredObject }): Promise<void> {
    const job = await this.findByIdForUser(id, userId);
    if (!job) return;
    if (files.sourceFiles) job.sourceFiles = files.sourceFiles;
    if (files.generatedImages) job.generatedImages = files.generatedImages;
    if (files.zipFile) job.zipFile = files.zipFile;
    job.updatedAt = new Date();
  }

  async findByIdForUser(id: string, userId: string): Promise<JobRecord | null> {
    const job = this.jobs.get(id);
    return job?.userId === userId ? job : null;
  }

  async listForUser(userId: string): Promise<JobRecord[]> {
    return [...this.jobs.values()]
      .filter((job) => job.userId === userId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 50);
  }
}
