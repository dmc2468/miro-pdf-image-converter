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
