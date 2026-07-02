import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

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
  id: string;
  name: string;
}

interface UserSessionResponse {
  token: string;
}

interface ApiErrorResponse {
  error?: string;
}

const recognisedChannels = new Set(["Hangout room 1", "Hangout room 2", "Hangout room 3"]);
const studioKeychainService = "Studio McLeod TeamSpeak Bridge";
const execFileAsync = promisify(execFile);

async function main() {
  const studioSettings = await studioConfig();
  const clientQuerySettings = await clientQueryConfig();
  const intervalMs = positiveInteger(process.env.TEAMSPEAK_BRIDGE_INTERVAL_MS, 2500);
  let lastChannelName: string | undefined;
  let reportedInitialStatus = false;

  process.stdout.write(`TeamSpeak bridge watching ${clientQuerySettings.host}:${clientQuerySettings.port}\n`);

  async function tick() {
    try {
      const channel = await currentTeamSpeakChannel(clientQuerySettings);
      await updateStudioTeamSpeakStatus(studioSettings, channel.name);
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
    const channelResponse = await client.command(`channelvariable cid=${channelId} channel_name`);
    const channelInfo = parseClientQueryLine(channelResponse.find((line) => line.startsWith("cid=")) ?? "");
    const channelName = channelInfo.channel_name;
    if (!channelName) {
      throw new Error("TeamSpeak did not return a current channel name.");
    }
    return { id: channelId, name: channelName };
  } finally {
    client.close();
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

    socket.setEncoding("utf8");
    socket.on("connect", () => {
      resolve({
        command(command: string) {
          return new Promise((commandResolve, commandReject) => {
            pending = commandResolve;
            pendingReject = commandReject;
            socket.write(`${command}\n`);
          });
        },
        close() {
          socket.end("quit\n");
        },
      });
    });
    socket.on("data", (chunk: string) => {
      buffer += chunk.replace(/\r/g, "");
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
        return;
      }
      reject(error);
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

async function updateStudioTeamSpeakStatus(config: StudioConfig, channelName: string | undefined): Promise<void> {
  const response = await fetch(`${config.baseUrl}/api/meeting-rooms/teamspeak-status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channelName }),
  });
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, "Could not update Studio TeamSpeak status."));
  }
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
  setInterval(() => {
    void callback();
  }, intervalMs);
}

void main();
