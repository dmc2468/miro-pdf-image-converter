import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Express } from "express";
import { MemoryJobRepository } from "../repositories/jobs.js";
import { LocalObjectStore } from "../storage/objectStore.js";
import { ConversionService, conversionFailureMessage, pdfRenderMaxDimension, scaledDimensions, tileRegions, tileSourceRegion } from "./conversion.js";

function hasPoppler(): boolean {
  try {
    execFileSync("pdftoppm", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const ONE_PAGE_PDF = Buffer.from(`%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 67 >> stream
BT /F1 24 Tf 72 760 Td (Studio McLeod parity test) Tj ET
0 0 m 595 842 l S
endstream endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000256 00000 n 
0000000326 00000 n 
trailer << /Root 1 0 R /Size 6 >>
startxref
443
%%EOF
`);

describe.skipIf(!hasPoppler())("ConversionService parity", () => {
  let tempRoot: string;
  let uploadPath: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "miro-converter-test-"));
    uploadPath = path.join(tempRoot, "uploads", "sample.pdf");
    await fs.mkdir(path.dirname(uploadPath), { recursive: true });
    await fs.writeFile(uploadPath, ONE_PAGE_PDF);
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("renders a PDF to the same target pixel width as the desktop scaling table", async () => {
    const jobs = new MemoryJobRepository();
    const store = new LocalObjectStore(path.join(tempRoot, "objects"));
    const service = new ConversionService(jobs, store);
    const uploadedFile = {
      fieldname: "files",
      originalname: "sample.pdf",
      encoding: "7bit",
      mimetype: "application/pdf",
      destination: path.dirname(uploadPath),
      filename: "sample.pdf",
      path: uploadPath,
      size: ONE_PAGE_PDF.length,
    } as Express.Multer.File;

    const result = await service.convert({
      userId: "user-1",
      files: [uploadedFile],
      settings: {
        paperSize: "A4",
        orientation: "Portrait",
        drawingScale: "1:100",
      },
    });

    const job = await jobs.findByIdForUser(result.jobId, "user-1");
    expect(job?.status).toBe("completed");
    expect(job?.targetPixelWidth).toBe(2098);
    expect(job?.generatedImages).toHaveLength(1);
    expect(job?.zipFile?.sizeBytes).toBeGreaterThan(0);

    const imagePath = path.join(tempRoot, "objects", job!.generatedImages[0].key);
    const metadata = await sharp(imagePath).metadata();
    expect(metadata.width).toBe(2098);
  }, 60_000);

  it("reruns a failed job from its stored source PDF", async () => {
    const jobs = new MemoryJobRepository();
    const store = new LocalObjectStore(path.join(tempRoot, "objects"));
    const service = new ConversionService(jobs, store);
    const sourceFile = await store.putFile({
      key: "users/user-1/jobs/failed-job/source/sample.pdf",
      filePath: uploadPath,
      contentType: "application/pdf",
      originalFileName: "sample.pdf",
    });
    const failedJob = await jobs.create({
      userId: "user-1",
      paperSize: "A4",
      orientation: "Portrait",
      drawingScale: "1:100",
      targetPixelWidth: 2098,
    });
    await jobs.updateFiles(failedJob._id, failedJob.userId, { sourceFiles: [sourceFile] });
    await jobs.updateStatus(failedJob._id, failedJob.userId, "failed", "The server restarted.");

    const result = await service.retry({ userId: "user-1", job: (await jobs.findById(failedJob._id))! });

    expect(result.job._id).not.toBe(failedJob._id);
    expect(result.job.status).toBe("completed");
    expect(result.job.generatedImages).toHaveLength(1);
    expect((await jobs.findById(failedJob._id))?.status).toBe("failed");
  }, 60_000);
});

describe("conversionFailureMessage", () => {
  it("turns libvips memory failures into an actionable message", () => {
    expect(conversionFailureMessage(new Error("VipsJpeg: Insufficient memory (case 4)"), 20900)).toBe(
      "The converter ran out of memory while creating the 20900px-wide JPEG. Please try again shortly; if it keeps happening, the production machine needs more memory for this drawing size.",
    );
  });

  it("keeps non-memory conversion failures intact", () => {
    expect(conversionFailureMessage(new Error("No pages were rendered from the uploaded PDF."), 20900)).toBe("No pages were rendered from the uploaded PDF.");
  });
});

describe("PDF render sizing", () => {
  it("renders ordinary pages at the requested final dimensions", () => {
    expect(pdfRenderMaxDimension(4200, "Landscape")).toBe(4200);
    expect(pdfRenderMaxDimension(2968, "Portrait")).toBe(4197);
  });

  it("caps oversized source renders to protect production memory", () => {
    expect(pdfRenderMaxDimension(8410, "Landscape")).toBe(8000);
    expect(pdfRenderMaxDimension(21000, "Portrait")).toBe(8000);
  });
});

describe("ConversionService queue", () => {
  it("runs only one conversion at a time", async () => {
    const jobs = new MemoryJobRepository();
    const activeWrites: number[] = [];
    let active = 0;
    const store = {
      async putFile(input: { key: string; filePath: string; contentType: string; originalFileName?: string }) {
        active += 1;
        activeWrites.push(active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return {
          key: input.key,
          contentType: input.contentType,
          originalFileName: input.originalFileName,
          sizeBytes: 1,
        };
      },
      async getReadStream() {
        throw new Error("Not needed by this test.");
      },
      async exists() {
        return false;
      },
    };
    const service = new ConversionService(jobs, store);
    const missingFile = (name: string) => ({
      originalname: name,
      path: `/missing/${name}`,
    } as Express.Multer.File);

    await Promise.allSettled([
      service.convert({ userId: "user-1", files: [missingFile("one.pdf")], settings: { paperSize: "A4", orientation: "Portrait", drawingScale: "1:100" } }),
      service.convert({ userId: "user-2", files: [missingFile("two.pdf")], settings: { paperSize: "A4", orientation: "Portrait", drawingScale: "1:100" } }),
    ]);

    expect(Math.max(...activeWrites)).toBe(1);
  });
});

describe("ConversionService retry", () => {
  it("rejects failed jobs whose source PDFs were not stored", async () => {
    const jobs = new MemoryJobRepository();
    const store = new LocalObjectStore(path.join(os.tmpdir(), "unused-converter-objects"));
    const service = new ConversionService(jobs, store);
    const job = await jobs.create({ userId: "user-1", paperSize: "A3", orientation: "Landscape", drawingScale: "1:100", targetPixelWidth: 4200 });
    await jobs.updateStatus(job._id, job.userId, "failed", "The server restarted.");

    await expect(service.retry({ userId: job.userId, job: (await jobs.findById(job._id))! })).rejects.toMatchObject({
      statusCode: 409,
      message: "No PDF stored in memory. Please re-upload.",
    });
  });
});

describe("Miro tile layout", () => {
  it("keeps small images as a single Miro-safe tile", () => {
    expect(tileRegions({ width: 2098, height: 2969 })).toEqual([
      {
        row: 1,
        column: 1,
        left: 0,
        top: 0,
        width: 2098,
        height: 2969,
      },
    ]);
  });

  it("splits a large A3 landscape target into Miro-safe tiles", () => {
    const sourceDimensions = { width: 3508, height: 2480 };
    const dimensions = scaledDimensions(sourceDimensions, 21000);
    const tiles = tileRegions(dimensions);

    expect(dimensions).toEqual({ width: 21000, height: 14846 });
    expect(tiles).toHaveLength(20);
    expect(tiles.every((tile) => tile.width <= 5600 && tile.height <= 3900 && tile.width * tile.height <= 15_900_000)).toBe(true);
    expect(tiles.at(0)).toEqual({
      row: 1,
      column: 1,
      left: 0,
      top: 0,
      width: 4200,
      height: 3712,
    });
    expect(tiles.at(-1)).toEqual({
      row: 4,
      column: 5,
      left: 16800,
      top: 11136,
      width: 4200,
      height: 3710,
    });
  });

  it("maps final tiles back to source crops before resizing", () => {
    const sourceDimensions = { width: 3508, height: 2480 };
    const targetDimensions = scaledDimensions(sourceDimensions, 21000);
    const tiles = tileRegions(targetDimensions);

    expect(tileSourceRegion(tiles[0], sourceDimensions, targetDimensions)).toEqual({
      left: 0,
      top: 0,
      width: 702,
      height: 621,
    });
    expect(tileSourceRegion(tiles[tiles.length - 1], sourceDimensions, targetDimensions)).toEqual({
      left: 2806,
      top: 1860,
      width: 702,
      height: 620,
    });
  });
});
