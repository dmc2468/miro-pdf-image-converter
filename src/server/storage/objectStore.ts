import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config.js";
import { ensureDir } from "../utils/files.js";

export type PutObjectInput = {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
  originalFileName?: string;
};

export type PutFileInput = {
  key: string;
  filePath: string;
  contentType: string;
  originalFileName?: string;
};

export type StoredObjectInfo = {
  bucket: string;
  key: string;
  originalFileName?: string;
  contentType: string;
  sizeBytes?: number;
};

export interface ObjectStore {
  bucket: string;
  putObject(input: PutObjectInput): Promise<StoredObjectInfo>;
  putFile(input: PutFileInput): Promise<StoredObjectInfo>;
  getReadStream(key: string): Promise<NodeJS.ReadableStream>;
}

export class S3ObjectStore implements ObjectStore {
  public readonly bucket: string;
  private readonly client: S3Client;

  constructor() {
    if (!config.s3) {
      throw new Error("S3 configuration is incomplete.");
    }
    this.bucket = config.s3.bucket;
    this.client = new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint,
      forcePathStyle: Boolean(config.s3.endpoint),
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });
  }

  async putObject(input: PutObjectInput): Promise<StoredObjectInfo> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return {
      bucket: this.bucket,
      key: input.key,
      originalFileName: input.originalFileName,
      contentType: input.contentType,
      sizeBytes: Buffer.byteLength(input.body),
    };
  }

  async putFile(input: PutFileInput): Promise<StoredObjectInfo> {
    const stats = await fsp.stat(input.filePath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: fs.createReadStream(input.filePath),
        ContentType: input.contentType,
      }),
    );
    return {
      bucket: this.bucket,
      key: input.key,
      originalFileName: input.originalFileName,
      contentType: input.contentType,
      sizeBytes: stats.size,
    };
  }

  async getReadStream(key: string): Promise<NodeJS.ReadableStream> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    if (!response.Body || typeof (response.Body as NodeJS.ReadableStream).pipe !== "function") {
      throw new Error("Stored object is not readable.");
    }
    return response.Body as NodeJS.ReadableStream;
  }

}

export class LocalObjectStore implements ObjectStore {
  public readonly bucket = "local-private-storage";

  constructor(private readonly rootDir: string) {}

  async putObject(input: PutObjectInput): Promise<StoredObjectInfo> {
    const destination = this.pathForKey(input.key);
    await ensureDir(path.dirname(destination));
    await fsp.writeFile(destination, input.body);
    const stats = await fsp.stat(destination);
    return {
      bucket: this.bucket,
      key: input.key,
      originalFileName: input.originalFileName,
      contentType: input.contentType,
      sizeBytes: stats.size,
    };
  }

  async putFile(input: PutFileInput): Promise<StoredObjectInfo> {
    const destination = this.pathForKey(input.key);
    await ensureDir(path.dirname(destination));
    await fsp.copyFile(input.filePath, destination);
    const stats = await fsp.stat(destination);
    return {
      bucket: this.bucket,
      key: input.key,
      originalFileName: input.originalFileName,
      contentType: input.contentType,
      sizeBytes: stats.size,
    };
  }

  async getReadStream(key: string): Promise<NodeJS.ReadableStream> {
    const filePath = this.pathForKey(key);
    await fsp.access(filePath);
    return fs.createReadStream(filePath);
  }

  private pathForKey(key: string): string {
    return path.join(this.rootDir, key);
  }
}

export async function createObjectStore(): Promise<ObjectStore> {
  if (config.s3) return new S3ObjectStore();
  await ensureDir(config.localStorageDir);
  return new LocalObjectStore(config.localStorageDir);
}
