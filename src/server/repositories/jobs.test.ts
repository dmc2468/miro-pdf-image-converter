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
    expect((await jobs.findById(processing._id))?.errorMessage).toContain("server restarted");
    expect((await jobs.findById(completed._id))?.status).toBe("completed");
  });
});
