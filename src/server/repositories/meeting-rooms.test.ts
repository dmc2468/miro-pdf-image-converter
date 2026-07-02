import { describe, expect, it } from "vitest";
import { MemoryMeetingRoomRepository } from "./meeting-rooms.js";

describe("MemoryMeetingRoomRepository", () => {
  it("clears the Miro board when the last participant leaves", async () => {
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
