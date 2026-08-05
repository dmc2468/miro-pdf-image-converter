import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import type { Express } from "express";
import type { ConversionSettings, StoredObject } from "../../shared/types.js";
import { getTargetPixelWidth } from "../../shared/scaling.js";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { objectKey, removeDir, safeFilename, safeStem } from "../utils/files.js";
import type { JobRepository, JobRecord } from "../repositories/jobs.js";
import type { ObjectStore } from "../storage/objectStore.js";
import { createZip } from "./zip.js";

const execFileAsync = promisify(execFile);
const MIRO_TILE_MAX_WIDTH = 5600;
const MIRO_TILE_MAX_HEIGHT = 3900;
const MIRO_TILE_MAX_AREA = 15_900_000;
sharp.cache(false);
sharp.concurrency(1);

interface ImageDimensions {
  width: number;
  height: number;
}

interface TileRegion {
  row: number;
  column: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface TileGrid {
  rows: number;
  columns: number;
  tileWidth: number;
  tileHeight: number;
}

interface RenderedPageInput {
  userId: string;
  jobId: string;
  baseName: string;
  renderedPath: string;
  resizedDir: string;
  multiPage: boolean;
  pageIndex: number;
  targetPixelWidth: number;
}

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
      const message = conversionFailureMessage(error, targetPixelWidth);
      await this.jobs.updateStatus(job._id, input.userId, "failed", message);
      throw new HttpError(500, message);
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
        images.push(...await this.createMiroImages({
          userId: input.userId,
          jobId: input.jobId,
          baseName,
          renderedPath: path.join(input.renderDir, renderedPage),
          resizedDir: input.resizedDir,
          multiPage,
          pageIndex: index,
          targetPixelWidth: input.targetPixelWidth,
        }));
      }
    }

    return images;
  }

  private async createMiroImages(input: RenderedPageInput): Promise<StoredObject[]> {
    const metadata = await sharp(input.renderedPath).metadata();
    const sourceDimensions = imageDimensions(metadata.width, metadata.height);
    const targetDimensions = scaledDimensions(sourceDimensions, input.targetPixelWidth);
    const tiles = tileRegions(targetDimensions);
    const storedImages: StoredObject[] = [];

    for (const tile of tiles) {
      const outputName = outputImageName(input.baseName, input.multiPage, input.pageIndex, tiles.length > 1, tile);
      const outputPath = path.join(input.resizedDir, outputName);
      await sharp(input.renderedPath)
        .resize({ width: targetDimensions.width, withoutEnlargement: false })
        .extract({
          left: tile.left,
          top: tile.top,
          width: tile.width,
          height: tile.height,
        })
        .jpeg({ quality: 95 })
        .toFile(outputPath);

      const stored = await this.objectStore.putFile({
        key: objectKey("users", input.userId, "jobs", input.jobId, "images", outputName),
        filePath: outputPath,
        contentType: "image/jpeg",
        originalFileName: outputName,
      });
      storedImages.push(stored);
    }

    return storedImages;
  }
}

export function scaledDimensions(sourceDimensions: ImageDimensions, targetPixelWidth: number): ImageDimensions {
  return {
    width: targetPixelWidth,
    height: Math.max(1, Math.round((sourceDimensions.height / sourceDimensions.width) * targetPixelWidth)),
  };
}

export function tileRegions(dimensions: ImageDimensions): TileRegion[] {
  const tiles: TileRegion[] = [];
  const grid = tileGrid(dimensions);

  for (const row of Array.from({ length: grid.rows }, (_value, index) => index)) {
    for (const column of Array.from({ length: grid.columns }, (_value, index) => index)) {
      const left = column * grid.tileWidth;
      const top = row * grid.tileHeight;
      tiles.push({
        row: row + 1,
        column: column + 1,
        left,
        top,
        width: Math.min(grid.tileWidth, dimensions.width - left),
        height: Math.min(grid.tileHeight, dimensions.height - top),
      });
    }
  }

  return tiles;
}

function tileGrid(dimensions: ImageDimensions): TileGrid {
  const minimumColumns = Math.ceil(dimensions.width / MIRO_TILE_MAX_WIDTH);
  const minimumRows = Math.ceil(dimensions.height / MIRO_TILE_MAX_HEIGHT);
  const maximumColumns = dimensions.width;
  const maximumRows = dimensions.height;
  let bestGrid: TileGrid | undefined;

  for (let rows = minimumRows; rows <= maximumRows; rows += 1) {
    if (bestGrid && rows * minimumColumns > bestGrid.rows * bestGrid.columns) break;

    for (let columns = minimumColumns; columns <= maximumColumns; columns += 1) {
      const tileWidth = Math.ceil(dimensions.width / columns);
      const tileHeight = Math.ceil(dimensions.height / rows);
      const grid: TileGrid = { rows, columns, tileWidth, tileHeight };
      const tileCount = rows * columns;

      if (bestGrid && tileCount > bestGrid.rows * bestGrid.columns) break;
      if (isMiroSafeGrid(grid) && (!bestGrid || tileCount < bestGrid.rows * bestGrid.columns)) {
        bestGrid = grid;
        break;
      }
    }
  }

  if (!bestGrid) {
    throw new Error("A Miro-safe tile grid could not be calculated.");
  }

  return bestGrid;
}

function isMiroSafeGrid(grid: TileGrid): boolean {
  return grid.tileWidth <= MIRO_TILE_MAX_WIDTH && grid.tileHeight <= MIRO_TILE_MAX_HEIGHT && grid.tileWidth * grid.tileHeight <= MIRO_TILE_MAX_AREA;
}

function imageDimensions(width: number | undefined, height: number | undefined): ImageDimensions {
  if (!width || !height) {
    throw new Error("The rendered PDF page size could not be read.");
  }
  return { width, height };
}

function outputImageName(baseName: string, multiPage: boolean, pageIndex: number, tiled: boolean, tile: TileRegion): string {
  const pageName = multiPage ? `${baseName}_page${pageIndex + 1}` : baseName;
  return tiled ? `${pageName}_row${tile.row}_col${tile.column}.jpg` : `${pageName}.jpg`;
}

export function conversionFailureMessage(error: unknown, targetPixelWidth: number): string {
  if (!isConversionMemoryError(error)) {
    return error instanceof Error ? error.message : "Conversion failed.";
  }

  return `The converter ran out of memory while creating the ${targetPixelWidth}px-wide JPEG. Please try again shortly; if it keeps happening, the production machine needs more memory for this drawing size.`;
}

function isConversionMemoryError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("insufficient memory") || message.includes("memory allocation") || message.includes("vipsjpeg");
}
