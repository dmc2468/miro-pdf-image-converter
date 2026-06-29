import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import multer from "multer";
import { config } from "./config.js";
import { createMagicToken, hashMagicToken, hashPassword, requireAdmin, requireAuth, signToken, verifyPassword, type AuthenticatedRequest } from "./auth.js";
import { HttpError, publicErrorMessage } from "./errors.js";
import type { Repositories } from "./repositories/index.js";
import { serializeJob } from "./repositories/jobs.js";
import { serializeAdminUser } from "./repositories/users.js";
import type { ObjectStore } from "./storage/objectStore.js";
import { ConversionService } from "./services/conversion.js";
import { isDrawingScale, isOrientation, isPaperSize } from "../shared/scaling.js";
import { rateLimit } from "./rateLimiter.js";

export function createApp(repositories: Repositories, objectStore: ObjectStore): express.Express {
  const app = express();
  const upload = multer({
    dest: path.join(config.tempDir, "uploads"),
    limits: {
      fileSize: config.maxUploadBytes,
      files: 20,
    },
    fileFilter: (_request, file, callback) => {
      const isPdf = file.originalname.toLowerCase().endsWith(".pdf") && (!file.mimetype || file.mimetype === "application/pdf");
      if (!isPdf) {
        callback(new HttpError(400, "Please upload PDF files only."));
        return;
      }
      callback(null, true);
    },
  });

  const conversionService = new ConversionService(repositories.jobs, objectStore);

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.use((request, _response, next) => {
    const start = Date.now();
    _response.on("finish", () => {
      const elapsed = Date.now() - start;
      console.log(`[request] ${request.method} ${request.path} ${_response.statusCode} ${elapsed}ms`);
    });
    next();
  });

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.post("/api/auth/register", async (_request, _response, next) => {
    next(new HttpError(404, "Self-registration is disabled. Ask an admin to create your account."));
  });

  app.post("/api/auth/magic-link", async (request, response, next) => {
    try {
      const { token, password } = request.body as { token?: string; password?: string };
      if (!token) {
        console.log(`[auth] magic-link missing token from ${request.ip}`);
        throw new HttpError(400, "Magic link token is required.");
      }
      if (password && password.length < 10) {
        console.log(`[auth] magic-link password too short from ${request.ip}`);
        throw new HttpError(400, "Password must be at least 10 characters.");
      }

      const user = await repositories.users.findByMagicLinkHash(hashMagicToken(token));
      if (!user) {
        console.log(`[auth] magic-link no user for token from ${request.ip}`);
        throw new HttpError(401, "This magic link is invalid or has expired.");
      }
      if (!user.magicLinkExpiresAt || user.magicLinkExpiresAt.getTime() < Date.now()) {
        console.log(`[auth] magic-link expired for ${user.email} from ${request.ip}`);
        throw new HttpError(401, "This magic link is invalid or has expired.");
      }
      if (user.magicLinkUsedAt) {
        console.log(`[auth] magic-link already used by ${user.email} from ${request.ip}`);
        throw new HttpError(401, "This magic link has already been used.");
      }

      console.log(`[auth] magic-link ok: ${user.email} from ${request.ip}`);

      const updatedUser = password ? await repositories.users.update({ id: user._id, passwordHash: await hashPassword(password) }) : user;
      await repositories.users.markMagicLinkUsed(user._id);

      response.json({
        token: signToken(updatedUser ?? user),
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", rateLimit(5, 60_000), async (request, response, next) => {
    try {
      const { email, password } = request.body as { email?: string; password?: string };
      if (!email || !password) {
        console.log(`[auth] login missing fields from ${request.ip}`);
        throw new HttpError(400, "Email and password are required.");
      }

      const user = await repositories.users.findByEmail(email);
      if (!user) {
        console.log(`[auth] login failed: no user for ${email} from ${request.ip}`);
        throw new HttpError(401, "Email or password was not recognised.");
      }

      const passwordOk = await verifyPassword(password, user.passwordHash);
      if (!passwordOk) {
        console.log(`[auth] login failed: wrong password for ${email} from ${request.ip}`);
        throw new HttpError(401, "Email or password was not recognised.");
      }

      console.log(`[auth] login ok: ${email} (${user.role}) from ${request.ip}`);
      response.json({
        token: signToken(user),
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/users", requireAuth, requireAdmin, async (_request, response, next) => {
    try {
      const users = await repositories.users.list();
      response.json({ users: users.map(serializeAdminUser) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/users", requireAuth, requireAdmin, async (request, response, next) => {
    try {
      const { email, name, role } = request.body as { email?: string; name?: string; role?: string };
      if (!email) {
        throw new HttpError(400, "Email is required.");
      }
      if (role && role !== "admin" && role !== "user") {
        throw new HttpError(400, "Role must be admin or user.");
      }

      const existing = await repositories.users.findByEmail(email);
      if (existing) {
        throw new HttpError(409, "A user already exists for that email.");
      }

      const user = await repositories.users.create({
        email,
        name,
        role: role === "admin" ? "admin" : "user",
        passwordHash: await hashPassword(createMagicToken()),
      });

      response.status(201).json({ user: serializeAdminUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/users/:userId", requireAuth, requireAdmin, async (request, response, next) => {
    try {
      const { name, role } = request.body as { name?: string; role?: string };
      if (role && role !== "admin" && role !== "user") {
        throw new HttpError(400, "Role must be admin or user.");
      }

      const user = await repositories.users.update({
        id: String(request.params.userId),
        name,
        role: role === "admin" ? "admin" : role === "user" ? "user" : undefined,
      });
      if (!user) {
        throw new HttpError(404, "User not found.");
      }

      response.json({ user: serializeAdminUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/users/:userId/magic-link", requireAuth, requireAdmin, async (request, response, next) => {
    try {
      const user = await repositories.users.findById(String(request.params.userId));
      if (!user) {
        throw new HttpError(404, "User not found.");
      }

      const token = createMagicToken();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
      await repositories.users.setMagicLink({
        id: user._id,
        tokenHash: hashMagicToken(token),
        expiresAt,
      });

      const magicLink = new URL("/magic-link", config.frontendBaseUrl);
      magicLink.searchParams.set("token", token);

      response.json({
        magicLink: magicLink.toString(),
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/jobs", requireAuth, async (request, response, next) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      const jobs = await repositories.jobs.listForUser(user.id);
      response.json({ jobs: jobs.map(serializeJob) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/jobs", requireAuth, upload.array("files"), async (request, response, next) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      const files = request.files as Express.Multer.File[] | undefined;
      const { paperSize, orientation, drawingScale } = request.body as Record<string, string>;

      if (!files?.length) {
        throw new HttpError(400, "Please upload at least one PDF.");
      }
      if (!isPaperSize(paperSize) || !isOrientation(orientation) || !isDrawingScale(drawingScale)) {
        throw new HttpError(400, "The selected page size, orientation or scale is not supported.");
      }

      const result = await conversionService.convert({
        userId: user.id,
        files,
        settings: {
          paperSize,
          orientation,
          drawingScale,
        },
      });

      response.status(201).json({
        job: serializeJob(result.job),
        downloadUrl: result.downloadUrl,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/jobs/:jobId/download", requireAuth, async (request, response, next) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      const jobId = String(request.params.jobId);
      const job = await repositories.jobs.findByIdForUser(jobId, user.id);
      if (!job?.zipFile) {
        throw new HttpError(404, "The ZIP file is not available.");
      }

      const stream = await objectStore.getReadStream(job.zipFile.key);
      response.setHeader("Content-Type", "application/zip");
      response.setHeader("Content-Disposition", 'attachment; filename="miro_converted_jpegs.zip"');
      stream.pipe(response);
    } catch (error) {
      next(error);
    }
  });

  const clientDir = path.resolve("dist/client");
  app.use(express.static(clientDir));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientDir, "index.html"));
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    response.status(statusCode).json({ error: publicErrorMessage(error) });
  });

  return app;
}
