import { describe, expect, it } from "vitest";
import { HttpError } from "./errors.js";
import { parseTeamSpeakStatusInput } from "./app.js";

describe("parseTeamSpeakStatusInput", () => {
  it("accepts a Meet link from a TeamSpeak room description", () => {
    expect(parseTeamSpeakStatusInput({
      channelName: "Hangout room 1",
      meetUrl: "https://meet.google.com/aaa-bbbb-ccc",
    })).toEqual({
      channelName: "Hangout room 1",
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
      meetUrl: null,
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
