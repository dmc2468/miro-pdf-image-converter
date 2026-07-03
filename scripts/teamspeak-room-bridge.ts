import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { CURRENT_TEAMSPEAK_BRIDGE_VERSION } from "../src/shared/teamspeak-bridge.js";
import { meetUrlFromTeamSpeakDescription } from "../src/shared/teamspeak.js";

interface ClientQueryConfig {
  host: string;
  port: number;
  apiKey: string;
}

interface StudioConfig {
  baseUrl: string;
  email?: string;
  token: string;
  userId?: string;
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
  bridgeVersion?: string;
  channelName?: string;
  errorMessage?: string | null;
  heartbeat?: boolean;
  meetUrl?: string | null;
  miroBoardUrl?: string;
}

interface MeetingRoomBoard {
  sharedByEmail?: string;
  sharedByUserId?: string;
  url: string;
}

interface MeetingRoomParticipant {
  email: string;
  userId: string;
}

interface MeetingRoom {
  id: string;
  meetUrl: string;
  miroBoard?: MeetingRoomBoard;
  participants: MeetingRoomParticipant[];
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

interface TokenPayload {
  email?: string;
  sub?: string;
}

const recognisedChannels = new Set(["Hangout room 1", "Hangout room 2", "Hangout room 3"]);
const studioKeychainService = "Studio McLeod TeamSpeak Bridge";
const controlPort = 37631;
const clientQueryTimeoutMs = 2_500;
const miroDetectionTimeoutMs = 750;
const miroOpenDelayMs = 7_000;
const rememberedMiroBoardMs = 120_000;
const bridgeHeartbeatMs = 10_000;
const execFileAsync = promisify(execFile);

async function main() {
  const studioSettings = await studioConfig();
  const intervalMs = positiveInteger(process.env.TEAMSPEAK_BRIDGE_INTERVAL_MS, 1000);
  let clientQuerySettings: ClientQueryConfig | undefined;
  let lastChannelName: string | undefined;
  let lastDetectedMiroBoardAt = 0;
  let lastDetectedMiroBoardUrl: string | undefined;
  let lastOpenedMeetKey: string | undefined;
  let lastOpenedMiroBoardKey: string | undefined;
  let reportedInitialStatus = false;
  let lastBridgeHeartbeatAt = 0;

  startControlServer();

  await bridgeHeartbeat();

  async function tick() {
    try {
      await bridgeHeartbeat();
      if (!clientQuerySettings) {
        clientQuerySettings = await clientQueryConfig();
        process.stdout.write(`TeamSpeak bridge watching ${clientQuerySettings.host}:${clientQuerySettings.port}\n`);
      }
      const channel = await currentTeamSpeakChannel(clientQuerySettings);
      const activeBoardUrl = await activeMiroBoardUrl();
      if (activeBoardUrl) {
        lastDetectedMiroBoardAt = Date.now();
        lastDetectedMiroBoardUrl = activeBoardUrl;
      }
      const recentBoardUrl = Date.now() - lastDetectedMiroBoardAt < rememberedMiroBoardMs ? lastDetectedMiroBoardUrl : undefined;
      const miroBoardUrl = recognisedChannels.has(channel.name) ? activeBoardUrl ?? recentBoardUrl : undefined;
      const studioStatus = await updateStudioTeamSpeakStatus(studioSettings, { channelName: channel.name, errorMessage: null, meetUrl: channel.meetUrl ?? null, miroBoardUrl });
      const openedMeetKey = await openRoomMeet(studioStatus, lastOpenedMeetKey, channel.meetUrl);
      if (openedMeetKey) lastOpenedMeetKey = openedMeetKey;
      const openedMiroBoardKey = await openRoomMiroBoard(studioStatus, lastOpenedMiroBoardKey, studioSettings);
      if (openedMiroBoardKey) lastOpenedMiroBoardKey = openedMiroBoardKey;
      if (!studioStatus.activeRoomId) {
        lastOpenedMeetKey = undefined;
        lastOpenedMiroBoardKey = undefined;
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
      await bridgeHeartbeat(true, message).catch((heartbeatError: unknown) => {
        const heartbeatMessage = heartbeatError instanceof Error ? heartbeatError.message : "Unknown TeamSpeak bridge heartbeat error.";
        process.stderr.write(`${new Date().toISOString()} ${heartbeatMessage}\n`);
      });
    }
  }

  async function bridgeHeartbeat(force = false, errorMessage?: string): Promise<void> {
    if (!force && Date.now() - lastBridgeHeartbeatAt < bridgeHeartbeatMs) return;
    await updateStudioTeamSpeakStatus(studioSettings, { errorMessage, heartbeat: true });
    lastBridgeHeartbeatAt = Date.now();
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
  if (process.env.STUDIO_MCLEOD_TOKEN) {
    const identity = tokenPayload(process.env.STUDIO_MCLEOD_TOKEN);
    return { baseUrl, email: process.env.STUDIO_MCLEOD_EMAIL ?? identity.email, token: process.env.STUDIO_MCLEOD_TOKEN, userId: identity.sub };
  }
  const credentials = await studioCredentials();
  if (!credentials) {
    throw new Error("Set STUDIO_MCLEOD_TOKEN or STUDIO_MCLEOD_EMAIL and STUDIO_MCLEOD_PASSWORD.");
  }
  const token = await studioToken(baseUrl, credentials);
  const identity = tokenPayload(token);
  return { baseUrl, email: identity.email ?? credentials.email, token, userId: identity.sub };
}

async function studioToken(baseUrl: string, credentials: StudioCredentials): Promise<string> {
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

function tokenPayload(token: string): TokenPayload {
  const payload = token.split(".")[1];
  if (!payload) return {};
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const value: unknown = JSON.parse(decoded);
    if (!objectRecord(value)) return {};
    return {
      email: typeof value.email === "string" ? value.email : undefined,
      sub: typeof value.sub === "string" ? value.sub : undefined,
    };
  } catch {
    return {};
  }
}

function objectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

interface PendingClientQueryCommand {
  reject(error: Error): void;
  resolve(lines: string[]): void;
  timeout: NodeJS.Timeout;
}

function connectClientQuery(config: ClientQueryConfig): Promise<ClientQueryConnection> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: config.host, port: config.port });
    let buffer = "";
    let pending: PendingClientQueryCommand | undefined;
    let ready = false;
    let settled = false;
    const readyTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error("TeamSpeak ClientQuery did not answer. Open TeamSpeak and enable ClientQuery."));
    }, clientQueryTimeoutMs);

    socket.setEncoding("utf8");
    function resolveConnection() {
      if (settled) return;
      settled = true;
      clearTimeout(readyTimeout);
      resolve({
        command(command: string) {
          return new Promise((commandResolve, commandReject) => {
            const commandTimeout = setTimeout(() => {
              if (pending?.reject !== commandReject) return;
              pending = undefined;
              commandReject(new Error("TeamSpeak ClientQuery did not respond to a command."));
            }, clientQueryTimeoutMs);
            pending = { reject: commandReject, resolve: commandResolve, timeout: commandTimeout };
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
      const command = pending;
      pending = undefined;
      clearTimeout(command.timeout);
      command.resolve(lines);
    });
    socket.on("error", (error) => {
      if (!ready && !settled) {
        settled = true;
        clearTimeout(readyTimeout);
        reject(new Error(`Could not connect to TeamSpeak ClientQuery on ${config.host}:${config.port}. Open TeamSpeak and enable ClientQuery.`));
        return;
      }
      if (pending) {
        const command = pending;
        pending = undefined;
        clearTimeout(command.timeout);
        command.reject(error);
      }
    });
    socket.on("close", () => {
      if (!ready) {
        if (!settled) {
          settled = true;
          clearTimeout(readyTimeout);
          reject(new Error("TeamSpeak ClientQuery closed before it was ready."));
        }
        return;
      }
      if (pending) {
        const command = pending;
        pending = undefined;
        clearTimeout(command.timeout);
        command.reject(new Error("TeamSpeak ClientQuery closed before it answered."));
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
    body: JSON.stringify({ ...input, bridgeVersion: CURRENT_TEAMSPEAK_BRIDGE_VERSION }),
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

async function openRoomMiroBoard(status: TeamSpeakStatusResponse, lastOpenedMiroBoardKey: string | undefined, studioSettings: StudioConfig): Promise<string | undefined> {
  if (!status.activeRoomId) return undefined;
  const room = status.rooms.find((item) => item.id === status.activeRoomId);
  const board = room?.miroBoard;
  const boardUrl = board?.url;
  if (!boardUrl) return undefined;
  if (room && ownRoomBoard(room, studioSettings)) return undefined;
  const boardKey = `${status.activeRoomId}:${board.sharedByEmail ?? "unknown"}:${boardUrl}`;
  if (boardKey === lastOpenedMiroBoardKey) return undefined;
  await delay(miroOpenDelayMs);
  await openMiroBoard(boardUrl);
  process.stdout.write(`${new Date().toISOString()} opened ${boardUrl}\n`);
  return boardKey;
}

function ownRoomBoard(room: MeetingRoom, studioSettings: StudioConfig): boolean {
  const board = room.miroBoard;
  if (!board) return false;
  if (studioSettings.userId && board.sharedByUserId === studioSettings.userId) return true;
  if (studioSettings.email && board.sharedByEmail?.toLowerCase() === studioSettings.email.toLowerCase()) return true;
  if (room.participants.length === 1) {
    const participant = room.participants[0];
    if (studioSettings.userId && participant?.userId === studioSettings.userId) return true;
    if (studioSettings.email && participant?.email.toLowerCase() === studioSettings.email.toLowerCase()) return true;
  }
  return false;
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

async function openMiroBoard(url: string): Promise<void> {
  if (process.platform === "darwin") {
    try {
      await execFileAsync("open", ["-a", "Miro", url]);
      return;
    } catch {
      await openUrl(url);
      return;
    }
  }
  await openUrl(url);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
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
