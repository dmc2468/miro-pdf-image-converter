import fs from "node:fs/promises";
import path from "node:path";

export function safeStem(filename: string): string {
  const parsed = path.parse(filename);
  const clean = parsed.name.replace(/[^a-z0-9 _-]/gi, "").trim();
  return clean || "converted_pdf";
}

export function safeFilename(filename: string): string {
  const parsed = path.parse(filename);
  const stem = safeStem(filename);
  const ext = parsed.ext.toLowerCase() === ".pdf" ? ".pdf" : "";
  return `${stem}${ext}`;
}

export async function ensureDir(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
}

export async function removeDir(directory: string): Promise<void> {
  await fs.rm(directory, { recursive: true, force: true });
}

export function objectKey(...parts: string[]): string {
  return parts.map((part) => part.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
}
