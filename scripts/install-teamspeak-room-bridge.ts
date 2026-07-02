import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { promisify } from "node:util";

interface UserSessionResponse {
  token: string;
}

interface ApiErrorResponse {
  error?: string;
}

interface BridgeSetup {
  email: string;
  password: string;
  baseUrl: string;
}

const execFileAsync = promisify(execFile);
const studioKeychainService = "Studio McLeod TeamSpeak Bridge";
const launchAgentLabel = "com.studiomcleod.teamspeak-room-bridge";
const repositoryPath = path.resolve(import.meta.dirname, "..");
const nodeDirectory = path.dirname(process.execPath);
const pnpmPath = process.env.npm_execpath ?? "pnpm";

async function main(): Promise<void> {
  const setup = await bridgeSetup();
  await verifyStudioLogin(setup);
  await savePassword(setup);
  const plistPath = await writeLaunchAgent(setup);
  await startLaunchAgent(plistPath);
  process.stdout.write("TeamSpeak bridge is installed and running in the background.\n");
}

async function bridgeSetup(): Promise<BridgeSetup> {
  const baseUrl = (process.env.STUDIO_MCLEOD_BASE_URL ?? "https://studio-mcleod.fly.dev").replace(/\/$/, "");
  const email = process.env.STUDIO_MCLEOD_EMAIL ?? await visiblePrompt("Studio McLeod email: ");
  const password = process.env.STUDIO_MCLEOD_PASSWORD ?? await hiddenPrompt("Studio McLeod password: ");
  return { email: email.trim(), password, baseUrl };
}

async function visiblePrompt(question: string): Promise<string> {
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await input.question(question);
  } finally {
    input.close();
  }
}

function hiddenPrompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const chunks: string[] = [];
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (character: string) => {
      if (character === "\r" || character === "\n") {
        stdin.off("data", onData);
        stdin.setRawMode(wasRaw);
        process.stdout.write("\n");
        resolve(chunks.join(""));
        return;
      }
      if (character === "\u0003") {
        process.exit(130);
      }
      if (character === "\u007f") {
        chunks.pop();
        return;
      }
      chunks.push(character);
    };
    stdin.on("data", onData);
  });
}

async function verifyStudioLogin(setup: BridgeSetup): Promise<void> {
  const response = await fetch(`${setup.baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: setup.email, password: setup.password }),
  });
  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, "Studio login failed."));
  }
  await response.json() as UserSessionResponse;
}

async function savePassword(setup: BridgeSetup): Promise<void> {
  await execFileAsync("security", ["add-generic-password", "-U", "-s", studioKeychainService, "-a", setup.email, "-w", setup.password]);
}

async function writeLaunchAgent(setup: BridgeSetup): Promise<string> {
  const launchAgentsDirectory = path.join(os.homedir(), "Library/LaunchAgents");
  const logsDirectory = path.join(os.homedir(), "Library/Logs/Studio McLeod");
  await fs.mkdir(launchAgentsDirectory, { recursive: true });
  await fs.mkdir(logsDirectory, { recursive: true });
  const plistPath = path.join(launchAgentsDirectory, `${launchAgentLabel}.plist`);
  const environment = [
    `STUDIO_MCLEOD_BASE_URL=${shellQuote(setup.baseUrl)}`,
    `STUDIO_MCLEOD_EMAIL=${shellQuote(setup.email)}`,
  ].join(" ");
  const command = [
    `cd ${shellQuote(repositoryPath)}`,
    `PATH=${shellQuote(nodeDirectory)}:$PATH ${environment} ${shellQuote(pnpmPath)} teamspeak:bridge`,
  ].join(" && ");
  const plist = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">",
    "<plist version=\"1.0\">",
    "<dict>",
    "<key>Label</key>",
    `<string>${xmlEscape(launchAgentLabel)}</string>`,
    "<key>ProgramArguments</key>",
    "<array>",
    "<string>/bin/zsh</string>",
    "<string>-lc</string>",
    `<string>${xmlEscape(command)}</string>`,
    "</array>",
    "<key>RunAtLoad</key>",
    "<true/>",
    "<key>KeepAlive</key>",
    "<true/>",
    "<key>StandardOutPath</key>",
    `<string>${xmlEscape(path.join(logsDirectory, "teamspeak-room-bridge.log"))}</string>`,
    "<key>StandardErrorPath</key>",
    `<string>${xmlEscape(path.join(logsDirectory, "teamspeak-room-bridge.error.log"))}</string>`,
    "</dict>",
    "</plist>",
  ].join("\n");
  await fs.writeFile(plistPath, `${plist}\n`, "utf8");
  return plistPath;
}

async function startLaunchAgent(plistPath: string): Promise<void> {
  const target = `gui/${process.getuid?.() ?? ""}`;
  await execFileAsync("launchctl", ["bootout", target, plistPath]).catch(() => undefined);
  await execFileAsync("launchctl", ["bootstrap", target, plistPath]);
  await execFileAsync("launchctl", ["kickstart", "-k", `${target}/${launchAgentLabel}`]);
}

async function apiErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => undefined) as ApiErrorResponse | undefined;
  return body?.error ?? fallback;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "TeamSpeak bridge setup failed.";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
