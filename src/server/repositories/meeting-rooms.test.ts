import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryMeetingRoomRepository } from "./meeting-rooms.js";

describe("MemoryMeetingRoomRepository", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T18:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the Miro board briefly when the last participant leaves", async () => {
    const repository = new MemoryMeetingRoomRepository();
    await repository.seedDefaults();
    await repository.join("call-hangout-1", {
      userId: "user-1",
      email: "duncan@studiomcleod.com",
      name: "Duncan Mcleod",
      joinedAt: new Date("2026-07-02T18:00:00.000Z").toISOString(),
    });
    await repository.shareBoard("call-hangout-1", {
      url: "https://miro.com/app/board/uXjVPVbwt10=/",
      sharedByUserId: "user-1",
      sharedByEmail: "duncan@studiomcleod.com",
      sharedByName: "Duncan Mcleod",
      sharedAt: new Date("2026-07-02T18:01:00.000Z").toISOString(),
    });

    const room = await repository.leave("call-hangout-1", "user-1");

    expect(room?.participants).toEqual([]);
    expect(room?.miroBoard?.url).toBe("https://miro.com/app/board/uXjVPVbwt10=/");
  });

  it("clears the Miro board when a room stays empty", async () => {
    const repository = new MemoryMeetingRoomRepository();
    await repository.seedDefaults();
    await repository.join("call-hangout-1", {
      userId: "user-1",
      email: "duncan@studiomcleod.com",
      name: "Duncan Mcleod",
      joinedAt: new Date("2026-07-02T18:00:00.000Z").toISOString(),
    });
    await repository.shareBoard("call-hangout-1", {
      url: "https://miro.com/app/board/uXjVPVbwt10=/",
      sharedByUserId: "user-1",
      sharedByEmail: "duncan@studiomcleod.com",
      sharedByName: "Duncan Mcleod",
      sharedAt: new Date("2026-07-02T18:01:00.000Z").toISOString(),
    });
    await repository.leave("call-hangout-1", "user-1");

    vi.setSystemTime(new Date("2026-07-02T18:00:16.000Z"));
    const rooms = await repository.list();
    const room = rooms.find((item) => item.id === "call-hangout-1");

    expect(room?.participants).toEqual([]);
    expect(room?.miroBoard).toBeUndefined();
  });

  it("keeps the Miro board when other participants remain", async () => {
    const repository = new MemoryMeetingRoomRepository();
    await repository.seedDefaults();
    await repository.join("call-hangout-1", {
      userId: "user-1",
      email: "duncan@studiomcleod.com",
      name: "Duncan Mcleod",
      joinedAt: new Date("2026-07-02T18:00:00.000Z").toISOString(),
    });
    await repository.join("call-hangout-1", {
      userId: "user-2",
      email: "sam@studiomcleod.com",
      name: "Sam",
      joinedAt: new Date("2026-07-02T18:02:00.000Z").toISOString(),
    });
    await repository.shareBoard("call-hangout-1", {
      url: "https://miro.com/app/board/uXjVPVbwt10=/",
      sharedByUserId: "user-1",
      sharedByEmail: "duncan@studiomcleod.com",
      sharedByName: "Duncan Mcleod",
      sharedAt: new Date("2026-07-02T18:01:00.000Z").toISOString(),
    });

    const room = await repository.leave("call-hangout-1", "user-1");

    expect(room?.participants.map((participant) => participant.userId)).toEqual(["user-2"]);
    expect(room?.miroBoard?.url).toBe("https://miro.com/app/board/uXjVPVbwt10=/");
  });
});
