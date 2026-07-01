import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { getShortGitHead } from "./git.js";

const execFileAsync = promisify(execFile);

export interface ReleaseEntry {
  sha: string;
  author: string;
  date: string;
  subject: string;
  body: string;
}

export interface BuildInfo {
  version: string;
  gitSha: string;
  generatedAt: string;
  entries: ReleaseEntry[];
}

async function loadFromBuildSnapshot(): Promise<BuildInfo | null> {
  try {
    const raw = await readFile(path.resolve("dist", "build-info.json"), "utf-8");
    return JSON.parse(raw) as BuildInfo;
  } catch {
    return null;
  }
}

async function loadFromGitLog(): Promise<BuildInfo> {
  const FS = "\x1f";
  const RS = "\x1e";
  const log = await execFileAsync(
    "git",
    [
      "-C", process.cwd(),
      "log", "-50",
      `--pretty=format:%H${FS}%an${FS}%aI${FS}%s${FS}%b${RS}`,
    ],
    { maxBuffer: 4 * 1024 * 1024 },
  );
  const entries = log.stdout
    .split(RS)
    .map((chunk) => chunk.replace(/^\n+/, "").trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const [sha, author, date, subject, ...rest] = chunk.split(FS);
      return {
        sha: (sha ?? "").slice(0, 7),
        author: author ?? "",
        date: date ?? "",
        subject: subject ?? "",
        body: rest.join(FS).trim(),
      };
    });

  const head = await getShortGitHead();

  return {
    version: "dev",
    gitSha: head,
    generatedAt: new Date().toISOString(),
    entries,
  };
}

let cached: BuildInfo | null = null;

export async function loadBuildInfo(): Promise<BuildInfo> {
  if (cached) return cached;
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    const snapshot = await loadFromBuildSnapshot();
    if (snapshot) {
      cached = snapshot;
      return snapshot;
    }
  }
  const live = await loadFromGitLog();
  if (isProduction) {
    cached = live;
  }
  return live;
}
