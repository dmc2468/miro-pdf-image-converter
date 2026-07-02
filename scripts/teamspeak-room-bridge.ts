import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { meetUrlFromTeamSpeakDescription } from "../src/shared/teamspeak.js";

interface ClientQueryConfig {
  host: string;
  port: number;
  apiKey: string;
}

interface StudioConfig {
  baseUrl: string;
  token: string;
}

interface StudioCredentials {
  email: string;
  password: string;
}

interface TeamSpeakChannel {
  description?: string;
  id: string;
  meetUrl?: string;
  name: string;
}

interface TeamSpeakStatusInput {
  channelName?: string;
  meetUrl?: string | null;
  miroBoardUrl?: string;
}

interface MeetingRoomBoard {
  url: string;
}

interface MeetingRoom {
  id: string;
  meetUrl: string;
  miroBoard?: MeetingRoomBoard;
}

interface TeamSpeakStatusResponse {
  activeRoomId?: string;
  rooms: MeetingRoom[];
}

interface UserSessionResponse {
  token: string;
}

interface ApiErrorResponse {
  error?: string;
}

const recognisedChannels = new Set(["Hangout room 1", "Hangout room 2", "Hangout room 3"]);
const studioKeychainService = "Studio McLeod TeamSpeak Bridge";
const controlPort = 37631;
const miroDetectionTimeoutMs = 750;
const execFileAsync = promisify(execFile);

async function main() {
  const studioSettings = await studioConfig();
  const clientQuerySettings = await clientQueryConfig();
  const intervalMs = positiveInteger(process.env.TEAMSPEAK_BRIDGE_INTERVAL_MS, 1000);
  let lastChannelName: string | undefined;
  let lastOpenedMeetKey: string | undefined;
  let lastOpenedMiroBoardKey: string | undefined;
  let reportedInitialStatus = false;

  process.stdout.write(`TeamSpeak bridge watching ${clientQuerySettings.host}:${clientQuerySettings.port}\n`);
  startControlServer();

  async function tick() {
    try {
      const channel = await currentTeamSpeakChannel(clientQuerySettings);
      let studioStatus = await updateStudioTeamSpeakStatus(studioSettings, { channelName: channel.name, meetUrl: channel.meetUrl ?? null });
      const openedMeetKey = await openRoomMeet(studioStatus, lastOpenedMeetKey, channel.meetUrl);
      if (openedMeetKey) lastOpenedMeetKey = openedMeetKey;
      const openedMiroBoardKey = await openRoomMiroBoard(studioStatus, lastOpenedMiroBoardKey);
      if (openedMiroBoardKey) lastOpenedMiroBoardKey = openedMiroBoardKey;
      if (!studioStatus.activeRoomId) {
        lastOpenedMeetKey = undefined;
        lastOpenedMiroBoardKey = undefined;
      }
      if (studioStatus.activeRoomId) {
        const miroBoardUrl = await activeMiroBoardUrl();
        if (miroBoardUrl) {
          studioStatus = await updateStudioTeamSpeakStatus(studioSettings, { channelName: channel.name, meetUrl: channel.meetUrl ?? null, miroBoardUrl });
          const updatedOpenedMeetKey = await openRoomMeet(studioStatus, lastOpenedMeetKey, channel.meetUrl);
          if (updatedOpenedMeetKey) lastOpenedMeetKey = updatedOpenedMeetKey;
          const updatedOpenedMiroBoardKey = await openRoomMiroBoard(studioStatus, lastOpenedMiroBoardKey);
          if (updatedOpenedMiroBoardKey) lastOpenedMiroBoardKey = updatedOpenedMiroBoardKey;
        }
      }
      if (!reportedInitialStatus || channel.name !== lastChannelName) {
        const status = recognisedChannels.has(channel.name) ? `joined ${channel.name}` : `left hangout rooms from ${channel.name}`;
        process.stdout.write(`${new Date().toISOString()} ${status}\n`);
        lastChannelName = channel.name;
        reportedInitialStatus = true;
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown TeamSpeak bridge error.";
      process.stderr.write(`${new Date().toISOString()} ${message}\n`);
    }
  }

  await tick();
  windowlessInterval(tick, intervalMs);
}

function startControlServer(): void {
  const server = http.createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "content-type");
    response.setHeader("Access-Control-Max-Age", "86400");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method === "GET" && request.url === "/status") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    if (request.method === "POST" && request.url === "/restart") {
      response.writeHead(202, { "content-type": "application/json" });
      response.end(JSON.stringify({ restarting: true }));
      setTimeout(() => process.exit(0), 100);
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
  });
  server.on("error", (caught) => {
    const message = caught instanceof Error ? caught.message : "Unknown bridge control error.";
    process.stderr.write(`${new Date().toISOString()} ${message}\n`);
  });
  server.listen(controlPort, "127.0.0.1");
}

async function studioConfig(): Promise<StudioConfig> {
  const baseUrl = (process.env.STUDIO_MCLEOD_BASE_URL ?? "https://studio-mcleod.fly.dev").replace(/\/$/, "");
  const token = process.env.STUDIO_MCLEOD_TOKEN ?? await studioToken(baseUrl);
  return { baseUrl, token };
}

async function studioToken(baseUrl: string): Promise<string> {
  const credentials = await studioCredentials();
  if (!credentials) {
    throw new Error("Set STUDIO_MCLEOD_TOKEN or STUDIO_MCLEOD_EMAIL and STUDIO_MCLEOD_PASSWORD.");
  }
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, "Studio login failed."));
  }
  const body = await response.json() as UserSessionResponse;
  return body.token;
}

async function studioCredentials(): Promise<StudioCredentials | undefined> {
  const email = process.env.STUDIO_MCLEOD_EMAIL;
  const password = process.env.STUDIO_MCLEOD_PASSWORD;
  if (!email) return undefined;
  if (password) return { email, password };
  const keychainPassword = await keychainStudioPassword(email);
  return keychainPassword ? { email, password: keychainPassword } : undefined;
}

async function keychainStudioPassword(email: string): Promise<string | undefined> {
  if (process.platform !== "darwin") return undefined;
  try {
    const { stdout } = await execFileAsync("security", ["find-generic-password", "-s", studioKeychainService, "-a", email, "-w"]);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function clientQueryConfig(): Promise<ClientQueryConfig> {
  const host = process.env.TEAMSPEAK_CLIENTQUERY_HOST ?? "127.0.0.1";
  const port = positiveInteger(process.env.TEAMSPEAK_CLIENTQUERY_PORT, 25639);
  const apiKey = process.env.TEAMSPEAK_CLIENTQUERY_API_KEY ?? await localClientQueryApiKey();
  return { host, port, apiKey };
}

async function localClientQueryApiKey(): Promise<string> {
  const filePath = path.join(os.homedir(), "Library/Application Support/TeamSpeak 3/clientquery.ini");
  const contents = await fs.readFile(filePath, "utf8");
  const match = /^api_key=(.+)$/m.exec(contents);
  if (!match?.[1]) {
    throw new Error(`Could not read TeamSpeak ClientQuery API key from ${filePath}.`);
  }
  return match[1].trim();
}

async function currentTeamSpeakChannel(config: ClientQueryConfig): Promise<TeamSpeakChannel> {
  const client = await connectClientQuery(config);
  try {
    await client.command(`auth apikey=${escapeClientQueryValue(config.apiKey)}`);
    const whoami = await client.command("whoami");
    const clientInfo = parseClientQueryLine(whoami.find((line) => line.startsWith("clid=")) ?? "");
    const channelId = clientInfo.cid;
    if (!channelId) {
      throw new Error("TeamSpeak did not return a current channel ID.");
    }
    const channelResponse = await client.command(`channelvariable cid=${channelId} channel_name channel_description`);
    const channelInfo = parseClientQueryLine(channelResponse.find((line) => line.startsWith("cid=")) ?? "");
    const channelName = channelInfo.channel_name;
    if (!channelName) {
      throw new Error("TeamSpeak did not return a current channel name.");
    }
    const description = channelInfo.channel_description;
    return {
      id: channelId,
      description,
      meetUrl: meetUrlFromTeamSpeakDescription(description),
      name: channelName,
    };
  } finally {
    client.close();
  }
}

async function activeMiroBoardUrl(): Promise<string | undefined> {
  if (process.platform !== "darwin") return undefined;
  const applicationName = await frontmostApplicationName();
  if (!applicationName) return undefined;
  if (applicationName === "Safari") return activeSafariMiroBoardUrl();
  if (["Google Chrome", "Brave Browser", "Microsoft Edge", "Arc"].includes(applicationName)) {
    return activeChromiumMiroBoardUrl(applicationName);
  }
  return undefined;
}

async function frontmostApplicationName(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "osascript",
      ["-e", "tell application \"System Events\" to name of first application process whose frontmost is true"],
      { timeout: miroDetectionTimeoutMs },
    );
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function activeChromiumMiroBoardUrl(applicationName: string): Promise<string | undefined> {
  const script = [
    `tell application "${applicationName}"`,
    "set tabUrl to URL of active tab of front window",
    "end tell",
    "return tabUrl",
  ];
  return osascriptMiroBoardUrl(script);
}

async function activeSafariMiroBoardUrl(): Promise<string | undefined> {
  const script = [
    "tell application \"Safari\"",
    "set tabUrl to URL of current tab of front window",
    "end tell",
    "return tabUrl",
  ];
  return osascriptMiroBoardUrl(script);
}

async function osascriptMiroBoardUrl(script: string[]): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("osascript", script.flatMap((line) => ["-e", line]), { timeout: miroDetectionTimeoutMs });
    const url = stdout.trim();
    return url.includes("miro.com/app/board/") ? url : undefined;
  } catch {
    return undefined;
  }
}

interface ClientQueryConnection {
  command(command: string): Promise<string[]>;
  close(): void;
}

function connectClientQuery(config: ClientQueryConfig): Promise<ClientQueryConnection> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: config.host, port: config.port });
    let buffer = "";
    let pending: ((lines: string[]) => void) | undefined;
    let pendingReject: ((error: Error) => void) | undefined;
    let ready = false;

    socket.setEncoding("utf8");
    function resolveConnection() {
      resolve({
        command(command: string) {
          return new Promise((commandResolve, commandReject) => {
            pending = commandResolve;
            pendingReject = commandReject;
            socket.write(`${command}\n`);
          });
        },
        close() {
          socket.destroy();
        },
      });
    }
    socket.on("data", (chunk: string) => {
      buffer += chunk.replace(/\r/g, "");
      if (!ready) {
        if (!buffer.includes("\n")) return;
        ready = true;
        buffer = "";
        resolveConnection();
        return;
      }
      if (!buffer.includes("error id=") || !pending) return;
      const lines = buffer.split("\n").map((line) => line.trim()).filter(Boolean);
      buffer = "";
      const commandResolve = pending;
      pending = undefined;
      pendingReject = undefined;
      commandResolve(lines);
    });
    socket.on("error", (error) => {
      if (pendingReject) {
        pendingReject(error);
        pendingReject = undefined;
      }
    });
    socket.on("close", () => {
      if (!ready) {
        reject(new Error("TeamSpeak ClientQuery closed before it was ready."));
        return;
      }
      if (pendingReject) {
        pendingReject(new Error("TeamSpeak ClientQuery closed before it answered."));
        pendingReject = undefined;
      }
    });
  });
}

function parseClientQueryLine(line: string): Record<string, string> {
  return line.split(" ").reduce<Record<string, string>>((result, part) => {
    const index = part.indexOf("=");
    if (index === -1) return result;
    const key = part.slice(0, index);
    const value = part.slice(index + 1);
    return {
      ...result,
      [key]: unescapeClientQueryValue(value),
    };
  }, {});
}

function escapeClientQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\//g, "\\/").replace(/\s/g, "\\s").replace(/\|/g, "\\p");
}

function unescapeClientQueryValue(value: string): string {
  return value
    .replace(/\\s/g, " ")
    .replace(/\\p/g, "|")
    .replace(/\\\//g, "/")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}

async function updateStudioTeamSpeakStatus(config: StudioConfig, input: TeamSpeakStatusInput): Promise<TeamSpeakStatusResponse> {
  const response = await fetch(`${config.baseUrl}/api/meeting-rooms/teamspeak-status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, "Could not update Studio TeamSpeak status."));
  }
  return await response.json() as TeamSpeakStatusResponse;
}

async function openRoomMeet(status: TeamSpeakStatusResponse, lastOpenedMeetKey: string | undefined, detectedMeetUrl: string | undefined): Promise<string | undefined> {
  if (!status.activeRoomId) return undefined;
  const room = status.rooms.find((item) => item.id === status.activeRoomId);
  const meetUrl = detectedMeetUrl ?? room?.meetUrl;
  if (!meetUrl) return undefined;
  const meetKey = `${status.activeRoomId}:${meetUrl}`;
  if (meetKey === lastOpenedMeetKey) return undefined;
  await openUrl(meetUrl);
  process.stdout.write(`${new Date().toISOString()} opened ${meetUrl}\n`);
  return meetKey;
}

async function openRoomMiroBoard(status: TeamSpeakStatusResponse, lastOpenedMiroBoardKey: string | undefined): Promise<string | undefined> {
  if (!status.activeRoomId) return undefined;
  const room = status.rooms.find((item) => item.id === status.activeRoomId);
  const boardUrl = room?.miroBoard?.url;
  if (!boardUrl) return undefined;
  const boardKey = `${status.activeRoomId}:${boardUrl}`;
  if (boardKey === lastOpenedMiroBoardKey) return undefined;
  await openUrl(boardUrl);
  process.stdout.write(`${new Date().toISOString()} opened ${boardUrl}\n`);
  return boardKey;
}

async function openUrl(url: string): Promise<void> {
  if (process.platform === "darwin") {
    await execFileAsync("open", [url]);
    return;
  }
  if (process.platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", url]);
    return;
  }
  await execFileAsync("xdg-open", [url]);
}

async function apiErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => undefined) as ApiErrorResponse | undefined;
  return body?.error ?? fallback;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function windowlessInterval(callback: () => Promise<void>, intervalMs: number): void {
  let running = false;
  setInterval(() => {
    if (running) return;
    running = true;
    void callback().finally(() => {
      running = false;
    });
  }, intervalMs);
}

void main();
