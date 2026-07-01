import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

export interface SessionEntry {
  id: string;
  title: string;
  date: string;
  trustedBodyHtml: string;
}

const SESSIONS_DIR = path.resolve("sessions");

function titleFromFilename(filename: string): string {
  const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-(\d{4}-)?/, "").replace(/\.md$/, "");
  return slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function wrapTablesForHorizontalScroll(html: string): string {
  return html.replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, "</table></div>");
}

async function parseSession(filename: string): Promise<SessionEntry> {
  const raw = await readFile(path.join(SESSIONS_DIR, filename), "utf-8");
  const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})-/);
  const date = dateMatch ? dateMatch[1]! : "";

  const lines = raw.split("\n");
  let title = titleFromFilename(filename);
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.length === 0) continue;
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      bodyStart = i + 1;
    }
    break;
  }

  const body = lines.slice(bodyStart).join("\n").trim();
  const trustedBodyHtml = wrapTablesForHorizontalScroll(await marked.parse(body));

  return {
    id: filename.replace(/\.md$/, ""),
    title,
    date,
    trustedBodyHtml,
  };
}

function sortFilenamesMostRecentFirst(filenames: string[]): string[] {
  return [...filenames].sort((a, b) => b.localeCompare(a));
}

export async function loadSessions(): Promise<SessionEntry[]> {
  let filenames: string[];
  try {
    filenames = (await readdir(SESSIONS_DIR)).filter((name) => name.endsWith(".md"));
  } catch {
    return [];
  }
  const sortedFilenames = sortFilenamesMostRecentFirst(filenames);
  return Promise.all(sortedFilenames.map(parseSession));
}
