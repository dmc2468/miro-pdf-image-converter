import { describe, expect, it } from "vitest";
import { createMockPropertyConstraintsReport } from "../services/property-constraints.js";
import { MemoryPropertySearchRepository } from "./property-searches.js";

describe("MemoryPropertySearchRepository", () => {
  it("saves, searches and promotes property searches", async () => {
    const repository = new MemoryPropertySearchRepository();
    const report = createMockPropertyConstraintsReport({
      clientName: "Jane Client",
      propertyAddress: "320 Kilburn Lane, London",
      propertyPostcode: "W9 3EF",
      searchDepth: "quick",
      projectTypes: ["House extension"],
    }, new Date("2026-07-04T12:00:00.000Z"));

    const saved = await repository.create({ userId: "user-1", report });
    const found = await repository.listForUser("user-1", "saved_search", "kilburn");

    expect(found.map((item) => item.id)).toEqual([saved.id]);

    const active = await repository.promoteToActiveProject(saved.id, "user-1", "2401");

    expect(active?.status).toBe("active_project");
    expect(active?.projectNumber).toBe("2401");
    await expect(repository.listForUser("user-1", "active_project", "2401")).resolves.toHaveLength(1);
  });
});
