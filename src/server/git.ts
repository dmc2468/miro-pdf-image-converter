import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function getShortGitHead(): Promise<string> {
  try {
    const result = await execFileAsync("git", ["-C", process.cwd(), "rev-parse", "--short", "HEAD"]);
    return result.stdout.trim();
  } catch {
    return "";
  }
}
