import { describe, expect, it } from "vitest";
import { MemoryStringingStateRepository } from "./stringing-states.js";

describe("MemoryStringingStateRepository", () => {
  it("keeps each user's tracker state separate", async () => {
    const repository = new MemoryStringingStateRepository();
    const first = { rows: [], adjustments: [], sundries: [{ id: "one", date: "2026-09-04", description: "Reel", direction: "ray-owes" as const, complete: false }] };
    const second = { rows: [], adjustments: [], sundries: [] };

    await repository.saveForUser("duncan", first);
    await repository.saveForUser("another-user", second);

    expect((await repository.findForUser("duncan"))?.state).toEqual(first);
    expect((await repository.findForUser("another-user"))?.state).toEqual(second);
  });
});

describe("planner persistence", () => {
  it("retains schedules and logistics alongside existing live tracker sections", async () => {
    const repository = new MemoryStringingStateRepository();
    const state = {
      rows: [{ id: "racket", source: "private" as const, row: 12, name: "Client", collectionDate: "2026-09-25", completionDate: "2026-09-26", workflowStatus: "Awaiting collection" as const, pickupDate: "2026-09-25", collectionType: "Locker", collectionFrom: "David Lloyd" }],
      adjustments: [], sundries: [], dmRackets: [], referrers: [], expenses: [], strings: [],
      planner: { unavailable: [], unavailableDays: ["2026-09-27"], visits: { "2026-09-25:AM": true }, assignments: { racket: "2026-09-26:10" } }
    };
    await repository.saveForUser("planner-owner", state);
    expect((await repository.findForUser("planner-owner"))?.state).toEqual(state);
    expect(await repository.findForUser("another-user")).toBeNull();
  });
});
