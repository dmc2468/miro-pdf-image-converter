import { describe, expect, it } from "vitest";
import { HttpError } from "./errors.js";
import { parseTeamSpeakStatusInput, shouldShareTeamSpeakMiroBoard } from "./app.js";
import type { MeetingRoomRecord } from "./repositories/meeting-rooms.js";

describe("parseTeamSpeakStatusInput", () => {
  it("accepts a Meet link from a TeamSpeak room description", () => {
    expect(parseTeamSpeakStatusInput({
      channelName: "Hangout room 1",
      meetUrl: "https://meet.google.com/aaa-bbbb-ccc",
    })).toEqual({
      channelName: "Hangout room 1",
      errorMessage: undefined,
      heartbeat: false,
      meetUrl: "https://meet.google.com/aaa-bbbb-ccc",
      miroBoardUrl: undefined,
    });
  });

  it("accepts null so the bridge can clear a removed Meet link", () => {
    expect(parseTeamSpeakStatusInput({
      channelName: "Hangout room 1",
      meetUrl: null,
    })).toEqual({
      channelName: "Hangout room 1",
      errorMessage: undefined,
      heartbeat: false,
      meetUrl: null,
      miroBoardUrl: undefined,
    });
  });

  it("accepts a bridge heartbeat without a TeamSpeak room", () => {
    expect(parseTeamSpeakStatusInput({
      heartbeat: true,
    })).toEqual({
      channelName: undefined,
      errorMessage: undefined,
      heartbeat: true,
      meetUrl: undefined,
      miroBoardUrl: undefined,
    });
  });

  it("accepts a bridge diagnostic message", () => {
    expect(parseTeamSpeakStatusInput({
      errorMessage: "TeamSpeak ClientQuery did not answer.",
      heartbeat: true,
    })).toEqual({
      channelName: undefined,
      errorMessage: "TeamSpeak ClientQuery did not answer.",
      heartbeat: true,
      meetUrl: undefined,
      miroBoardUrl: undefined,
    });
  });

  it("rejects non-Meet links", () => {
    expect(() => parseTeamSpeakStatusInput({
      channelName: "Hangout room 1",
      meetUrl: "https://example.com/not-a-meet",
    })).toThrow(HttpError);
  });
});

describe("shouldShareTeamSpeakMiroBoard", () => {
  it("allows the first participant to claim an empty room board", () => {
    const room = meetingRoomRecord({
      participants: [
        {
          userId: "user-1",
          email: "duncan@studiomcleod.com",
          name: "Duncan Mcleod",
          joinedAt: "2026-07-02T18:00:00.000Z",
        },
      ],
    });

    expect(shouldShareTeamSpeakMiroBoard(null, room, "user-1")).toBe(true);
  });

  it("does not let a later participant overwrite the first participant board", () => {
    const roomBeforeJoin = meetingRoomRecord({
      participants: [
        {
          userId: "user-1",
          email: "duncan@studiomcleod.com",
          name: "Duncan Mcleod",
          joinedAt: "2026-07-02T18:00:00.000Z",
        },
      ],
    });
    const roomAfterJoin = meetingRoomRecord({
      participants: [
        {
          userId: "user-1",
          email: "duncan@studiomcleod.com",
          name: "Duncan Mcleod",
          joinedAt: "2026-07-02T18:00:00.000Z",
        },
        {
          userId: "user-2",
          email: "sam@studiomcleod.com",
          name: "Sam",
          joinedAt: "2026-07-02T18:02:00.000Z",
        },
      ],
    });

    expect(shouldShareTeamSpeakMiroBoard(roomBeforeJoin, roomAfterJoin, "user-2")).toBe(false);
  });

  it("does not replace an existing room board", () => {
    const room = meetingRoomRecord({
      miroBoard: {
        url: "https://miro.com/app/board/uXjVPVbwt10=/",
        sharedByUserId: "user-1",
        sharedByEmail: "duncan@studiomcleod.com",
        sharedByName: "Duncan Mcleod",
        sharedAt: "2026-07-02T18:01:00.000Z",
      },
      participants: [
        {
          userId: "user-1",
          email: "duncan@studiomcleod.com",
          name: "Duncan Mcleod",
          joinedAt: "2026-07-02T18:00:00.000Z",
        },
      ],
    });

    expect(shouldShareTeamSpeakMiroBoard(null, room, "user-1")).toBe(false);
  });
});

function meetingRoomRecord(input: Partial<MeetingRoomRecord>): MeetingRoomRecord {
  return {
    id: "call-hangout-1",
    name: "Hangout room 1",
    teamspeakChannelName: "Hangout room 1",
    meetUrl: "https://meet.google.com/aaa-bbbb-ccc",
    participants: [],
    createdAt: new Date("2026-07-02T18:00:00.000Z"),
    updatedAt: new Date("2026-07-02T18:00:00.000Z"),
    ...input,
  };
}
