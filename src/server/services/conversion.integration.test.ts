import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Express } from "express";
import { MemoryJobRepository } from "../repositories/jobs.js";
import { LocalObjectStore } from "../storage/objectStore.js";
import { ConversionService, conversionFailureMessage, scaledDimensions, tileRegions } from "./conversion.js";

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
    const dimensions = scaledDimensions({ width: 3508, height: 2480 }, 21000);
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
});
