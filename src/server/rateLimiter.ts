import type { NextFunction, Request, Response } from "express";

const buckets = new Map<string, { count: number; resetAt: number }>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (now > entry.resetAt) buckets.delete(key);
    }
  }, 60_000);
}

export function rateLimit(maxAttempts: number, windowMs: number) {
  startCleanup();

  return (request: Request, response: Response, next: NextFunction): void => {
    const ip = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const entry = buckets.get(ip);

    if (!entry || now > entry.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxAttempts) {
      response.status(429).json({ error: "Too many attempts. Please try again later." });
      return;
    }

    entry.count++;
    next();
  };
}
