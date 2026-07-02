import { describe, expect, it } from "vitest";
import { meetUrlFromTeamSpeakDescription } from "./teamspeak.js";

describe("meetUrlFromTeamSpeakDescription", () => {
  it("extracts a plain Google Meet link", () => {
    expect(meetUrlFromTeamSpeakDescription("Meet https://meet.google.com/xeo-ogbc-mrz")).toBe("https://meet.google.com/xeo-ogbc-mrz");
  });

  it("extracts a Google Meet link from TeamSpeak URL markup", () => {
    expect(meetUrlFromTeamSpeakDescription("[URL]https://meet.google.com/xeo-ogbc-mrz[/URL]")).toBe("https://meet.google.com/xeo-ogbc-mrz");
  });

  it("trims trailing punctuation", () => {
    expect(meetUrlFromTeamSpeakDescription("Meet https://meet.google.com/xeo-ogbc-mrz.")).toBe("https://meet.google.com/xeo-ogbc-mrz");
  });
});
