import { describe, expect, it } from "vitest";
import { MemoryTeamSpeakBridgeRepository } from "./teamspeak-bridges.js";

describe("MemoryTeamSpeakBridgeRepository", () => {
  it("keeps the current room when a heartbeat refreshes the bridge status", async () => {
    const repository = new MemoryTeamSpeakBridgeRepository();
    await repository.update({
      userId: "user-1",
      email: "sam@studiomcleod.com",
      name: "Sam",
      channelName: "Hangout room 1",
      activeRoomId: "call-hangout-1",
    });

    const status = await repository.update({
      userId: "user-1",
      email: "sam@studiomcleod.com",
      name: "Sam",
    });

    expect(status.channelName).toBe("Hangout room 1");
    expect(status.activeRoomId).toBe("call-hangout-1");
  });

  it("clears the current room when TeamSpeak reports a non-hangout channel", async () => {
    const repository = new MemoryTeamSpeakBridgeRepository();
    await repository.update({
      userId: "user-1",
      email: "sam@studiomcleod.com",
      channelName: "Hangout room 1",
      activeRoomId: "call-hangout-1",
    });

    const status = await repository.update({
      userId: "user-1",
      email: "sam@studiomcleod.com",
      channelName: "Reception",
      activeRoomId: null,
    });

    expect(status.channelName).toBe("Reception");
    expect(status.activeRoomId).toBeUndefined();
  });

  it("clears a diagnostic error after a successful TeamSpeak room update", async () => {
    const repository = new MemoryTeamSpeakBridgeRepository();
    await repository.update({
      userId: "user-1",
      email: "sam@studiomcleod.com",
      errorMessage: "TeamSpeak ClientQuery did not answer.",
    });

    const status = await repository.update({
      userId: "user-1",
      email: "sam@studiomcleod.com",
      channelName: "Hangout room 2",
      errorMessage: null,
      activeRoomId: "call-hangout-2",
    });

    expect(status.errorMessage).toBeUndefined();
    expect(status.channelName).toBe("Hangout room 2");
    expect(status.activeRoomId).toBe("call-hangout-2");
  });
});
