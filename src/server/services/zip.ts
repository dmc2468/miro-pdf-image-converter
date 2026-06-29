import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import archiver from "archiver";

export type ZipEntry = {
  path: string;
  name: string;
};

export async function createZip(entries: ZipEntry[], outputPath: string): Promise<void> {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const output = fs.createWriteStream(outputPath);

  for (const entry of entries) {
    archive.file(entry.path, { name: entry.name });
  }

  const finalize = archive.finalize();
  await Promise.all([pipeline(archive, output), finalize]);
}
