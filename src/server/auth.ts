import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { HttpError } from "./errors.js";
import type { UserRecord } from "./repositories/users.js";
import type { UserRole } from "../shared/types.js";

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
};

export type AuthenticatedRequest = Request & {
  user: AuthUser;
};

type TokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function createMagicToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashMagicToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function signToken(user: Pick<UserRecord, "_id" | "email" | "role">): string {
  const options: SignOptions = { expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign(
    {
      sub: user._id,
      email: user.email,
      role: user.role,
    } satisfies TokenPayload,
    config.jwtSecret,
    options,
  );
}

export function requireAuth(request: Request, _response: Response, next: NextFunction): void {
  const header = request.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    next(new HttpError(401, "Please log in to continue."));
    return;
  }

  try {
    const token = header.slice("Bearer ".length);
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    (request as AuthenticatedRequest).user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch {
    next(new HttpError(401, "Your session has expired. Please log in again."));
  }
}

export function requireAdmin(request: Request, _response: Response, next: NextFunction): void {
  const user = (request as AuthenticatedRequest).user;
  if (user?.role !== "admin") {
    next(new HttpError(403, "Admin access is required."));
    return;
  }
  next();
}
