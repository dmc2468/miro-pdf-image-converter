import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import type { Express } from "express";
import type { ConversionSettings, StoredObject } from "../../shared/types.js";
import { getTargetPixelWidth } from "../../shared/scaling.js";
import { config } from "../config.js";
import { objectKey, removeDir, safeFilename, safeStem } from "../utils/files.js";
import type { JobRepository, JobRecord } from "../repositories/jobs.js";
import type { ObjectStore } from "../storage/objectStore.js";
import { createZip } from "./zip.js";

const execFileAsync = promisify(execFile);

export class ConversionService {
  constructor(
    private readonly jobs: JobRepository,
    private readonly objectStore: ObjectStore,
  ) {}

  async convert(input: {
    userId: string;
    files: Express.Multer.File[];
    settings: ConversionSettings;
  }): Promise<{ jobId: string; job: JobRecord; downloadUrl: string | null }> {
    const targetPixelWidth = getTargetPixelWidth(input.settings.paperSize, input.settings.orientation, input.settings.drawingScale);
    const job = await this.jobs.create({
      userId: input.userId,
      paperSize: input.settings.paperSize,
      orientation: input.settings.orientation,
      drawingScale: input.settings.drawingScale,
      targetPixelWidth,
    });

    const jobDir = path.join(config.tempDir, job._id);
    const renderDir = path.join(jobDir, "rendered");
    const resizedDir = path.join(jobDir, "resized");

    try {
      await this.jobs.updateStatus(job._id, input.userId, "processing");
      await fs.mkdir(renderDir, { recursive: true });
      await fs.mkdir(resizedDir, { recursive: true });

      const sourceFiles = await this.storeSources(input.userId, job._id, input.files);
      await this.jobs.updateFiles(job._id, input.userId, { sourceFiles });

      const generatedImages = await this.renderAndResize({
        userId: input.userId,
        jobId: job._id,
        files: input.files,
        renderDir,
        resizedDir,
        targetPixelWidth,
      });

      const zipPath = path.join(jobDir, "miro_converted_jpegs.zip");
      await createZip(
        generatedImages.map((image) => ({
          path: path.join(resizedDir, path.basename(image.key)),
          name: path.basename(image.key),
        })),
        zipPath,
      );

      const zipKey = objectKey("users", input.userId, "jobs", job._id, "downloads", `${job._id}.zip`);
      const zipFile = await this.objectStore.putFile({
        key: zipKey,
        filePath: zipPath,
        contentType: "application/zip",
        originalFileName: "miro_converted_jpegs.zip",
      });

      const now = new Date();
      await this.jobs.updateFiles(job._id, input.userId, { generatedImages, zipFile });
      await this.jobs.updateStatus(job._id, input.userId, "completed");

      const completedJob: JobRecord = {
        ...job,
        sourceFiles,
        generatedImages,
        zipFile,
        status: "completed",
        updatedAt: now,
        completedAt: now,
      };

      return {
        jobId: job._id,
        job: completedJob,
        downloadUrl: `/api/jobs/${job._id}/download`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Conversion failed.";
      await this.jobs.updateStatus(job._id, input.userId, "failed", message);
      throw error;
    } finally {
      await removeDir(jobDir);
      for (const file of input.files) {
        await fs.rm(file.path, { force: true });
      }
    }
  }

  private async storeSources(userId: string, jobId: string, files: Express.Multer.File[]): Promise<StoredObject[]> {
    return Promise.all(
      files.map((file) =>
        this.objectStore.putFile({
          key: objectKey("users", userId, "jobs", jobId, "source", safeFilename(file.originalname)),
          filePath: file.path,
          contentType: "application/pdf",
          originalFileName: file.originalname,
        }),
      ),
    );
  }

  private async renderAndResize(input: {
    userId: string;
    jobId: string;
    files: Express.Multer.File[];
    renderDir: string;
    resizedDir: string;
    targetPixelWidth: number;
  }): Promise<StoredObject[]> {
    const images: StoredObject[] = [];

    for (const file of input.files) {
      const baseName = safeStem(file.originalname);
      const prefix = path.join(input.renderDir, `${input.jobId}-${baseName}`);
      await execFileAsync("pdftoppm", ["-jpeg", "-r", "300", file.path, prefix], {
        maxBuffer: 1024 * 1024 * 20,
      });

      const renderedPages = (await fs.readdir(input.renderDir))
        .filter((name) => name.startsWith(`${input.jobId}-${baseName}-`) && name.endsWith(".jpg"))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

      if (renderedPages.length === 0) {
        throw new Error("No pages were rendered from the uploaded PDF.");
      }

      const multiPage = renderedPages.length > 1;

      for (const [index, renderedPage] of renderedPages.entries()) {
        const outputName = multiPage ? `${baseName}_page${index + 1}.jpg` : `${baseName}.jpg`;
        const outputPath = path.join(input.resizedDir, outputName);
        await sharp(path.join(input.renderDir, renderedPage))
          .resize({ width: input.targetPixelWidth, withoutEnlargement: false })
          .jpeg({ quality: 95 })
          .toFile(outputPath);

        const stored = await this.objectStore.putFile({
          key: objectKey("users", input.userId, "jobs", input.jobId, "images", outputName),
          filePath: outputPath,
          contentType: "image/jpeg",
          originalFileName: outputName,
        });
        images.push(stored);
      }
    }

    return images;
  }
}
