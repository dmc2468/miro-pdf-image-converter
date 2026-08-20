import { describe, expect, it } from "vitest";
import { MemoryJobRepository } from "./jobs.js";

describe("MemoryJobRepository", () => {
  it("marks unfinished jobs as failed after a restart", async () => {
    const jobs = new MemoryJobRepository();
    const pending = await jobs.create({ userId: "user-1", paperSize: "A3", orientation: "Landscape", drawingScale: "1:100", targetPixelWidth: 4200 });
    const processing = await jobs.create({ userId: "user-2", paperSize: "A3", orientation: "Landscape", drawingScale: "1:100", targetPixelWidth: 4200 });
    const completed = await jobs.create({ userId: "user-3", paperSize: "A3", orientation: "Landscape", drawingScale: "1:100", targetPixelWidth: 4200 });
    await jobs.updateStatus(processing._id, processing.userId, "processing");
    await jobs.updateStatus(completed._id, completed.userId, "completed");

    await jobs.failInterrupted();

    expect((await jobs.findById(pending._id))?.status).toBe("failed");
    expect((await jobs.findById(processing._id))?.status).toBe("failed");
    expect((await jobs.findById(processing._id))?.errorMessage).toBe("No PDF stored in memory. Please re-upload.");
    expect((await jobs.findById(completed._id))?.status).toBe("completed");
  });

  it("directs interrupted jobs with stored PDFs to Retry", async () => {
    const jobs = new MemoryJobRepository();
    const job = await jobs.create({ userId: "user-1", paperSize: "A3", orientation: "Landscape", drawingScale: "1:100", targetPixelWidth: 4200 });
    await jobs.updateFiles(job._id, job.userId, {
      sourceFiles: [{ bucket: "test", key: "source/drawing.pdf", contentType: "application/pdf", originalFileName: "drawing.pdf" }],
    });
    await jobs.updateStatus(job._id, job.userId, "processing");

    await jobs.failInterrupted();

    expect((await jobs.findById(job._id))?.errorMessage).toBe("The conversion was interrupted when the server restarted. Use Retry to run it again.");
  });
});
