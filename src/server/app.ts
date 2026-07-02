import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import { config } from "./config.js";
import { createMagicToken, hashMagicToken, hashPassword, requireAdmin, requireAuth, signToken, verifyPassword, type AuthenticatedRequest } from "./auth.js";
import { HttpError, publicErrorMessage } from "./errors.js";
import type { Repositories } from "./repositories/index.js";
import { serializeJob, type JobRecord } from "./repositories/jobs.js";
import { serializeAdminUser, type UserRecord } from "./repositories/users.js";
import type { ObjectStore } from "./storage/objectStore.js";
import { ConversionService } from "./services/conversion.js";
import { isDrawingScale, isOrientation, isPaperSize } from "../shared/scaling.js";
import type { ConversionJob, MeetingRoomBoardInput, MeetingRoomId, MeetingRoomInput, VoiceCommandInput, VoiceCommandModifier, VoiceCommandRunResult } from "../shared/types.js";
import { logger } from "./logger.js";
import { rateLimit } from "./rateLimiter.js";
import { loadBuildInfo } from "./release-notes.js";
import { loadSessions } from "./sessions.js";
import { serializeMeetingRoom } from "./repositories/meeting-rooms.js";
import { isVoiceCommandActionType, isVoiceCommandModifier, isVoiceCommandTargetApp, normaliseVoiceCommandInput, serializeVoiceCommand, type VoiceCommandRecord } from "./repositories/voice-commands.js";

const execFileAsync = promisify(execFile);

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

  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false, frameguard: false }));
  app.use(cors({ origin: config.frontendBaseUrl }));
  app.use(express.json({ limit: "1mb" }));

  app.use((_request, response, next) => {
    response.setHeader("Content-Security-Policy", "frame-ancestors 'self' https://miro.com https://*.miro.com");
    next();
  });

  app.use((request, response, next) => {
    const start = Date.now();
    response.on("finish", () => {
      const elapsed = Date.now() - start;
      logger.info({
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        elapsedMs: elapsed,
      }, "request completed");
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
        logger.warn({ ip: request.ip }, "magic link missing token");
        throw new HttpError(400, "Magic link token is required.");
      }
      if (password && password.length < 10) {
        logger.warn({ ip: request.ip }, "magic link password too short");
        throw new HttpError(400, "Password must be at least 10 characters.");
      }

      const user = await repositories.users.findByMagicLinkHash(hashMagicToken(token));
      if (!user) {
        logger.warn({ ip: request.ip }, "magic link user not found");
        throw new HttpError(401, "This magic link is invalid or has expired.");
      }
      if (!user.magicLinkExpiresAt || user.magicLinkExpiresAt.getTime() < Date.now()) {
        logger.warn({ email: user.email, ip: request.ip }, "magic link expired");
        throw new HttpError(401, "This magic link is invalid or has expired.");
      }
      if (user.magicLinkUsedAt) {
        logger.warn({ email: user.email, ip: request.ip }, "magic link already used");
        throw new HttpError(401, "This magic link has already been used.");
      }

      logger.info({ email: user.email, role: user.role, ip: request.ip }, "magic link authenticated");

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
        logger.warn({ ip: request.ip }, "login missing fields");
        throw new HttpError(400, "Email and password are required.");
      }

      const user = await repositories.users.findByEmail(email);
      if (!user) {
        logger.warn({ email, ip: request.ip }, "login user not found");
        throw new HttpError(401, "Email or password was not recognised.");
      }

      const passwordOk = await verifyPassword(password, user.passwordHash);
      if (!passwordOk) {
        logger.warn({ email, ip: request.ip }, "login password mismatch");
        throw new HttpError(401, "Email or password was not recognised.");
      }

      logger.info({ email, role: user.role, ip: request.ip }, "login authenticated");
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

  app.patch("/api/auth/password", requireAuth, async (request, response, next) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      const { currentPassword, newPassword } = request.body as { currentPassword?: string; newPassword?: string };

      if (!currentPassword || !newPassword) {
        throw new HttpError(400, "Current password and new password are required.");
      }
      if (newPassword.length < 10) {
        throw new HttpError(400, "New password must be at least 10 characters.");
      }

      const storedUser = await repositories.users.findById(user.id);
      if (!storedUser?.passwordHash) {
        throw new HttpError(400, "You do not have a password set. Use a magic link to set one.");
      }

      const passwordOk = await verifyPassword(currentPassword, storedUser.passwordHash);
      if (!passwordOk) {
        throw new HttpError(401, "Current password is incorrect.");
      }

      await repositories.users.update({
        id: user.id,
        passwordHash: await hashPassword(newPassword),
      });

      logger.info({ email: user.email }, "password changed");
      response.json({ message: "Password updated." });
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

  app.delete("/api/admin/users/:userId", requireAuth, requireAdmin, async (request, response, next) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      if (request.params.userId === user.id) {
        throw new HttpError(400, "Cannot delete yourself.");
      }

      const target = await repositories.users.findById(String(request.params.userId));
      if (!target) {
        throw new HttpError(404, "User not found.");
      }

      await repositories.users.delete(target._id);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/voice-commands", requireAuth, async (_request, response, next) => {
    try {
      const commands = await repositories.voiceCommands.list();
      response.json({ commands: commands.map(serializeVoiceCommand) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/voice-commands", requireAuth, requireAdmin, async (request, response, next) => {
    try {
      const input = parseVoiceCommandInput(request.body);
      const command = await repositories.voiceCommands.create(input);
      response.status(201).json({ command: serializeVoiceCommand(command) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/voice-commands/:commandId", requireAuth, requireAdmin, async (request, response, next) => {
    try {
      const existing = await repositories.voiceCommands.findById(String(request.params.commandId));
      if (!existing) {
        throw new HttpError(404, "Voice command not found.");
      }
      const input = parsePartialVoiceCommandInput(request.body);
      const command = await repositories.voiceCommands.update(existing.id, input);
      if (!command) {
        throw new HttpError(404, "Voice command not found.");
      }
      response.json({ command: serializeVoiceCommand(command) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/voice-commands/:commandId", requireAuth, requireAdmin, async (request, response, next) => {
    try {
      await repositories.voiceCommands.delete(String(request.params.commandId));
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/voice-commands/import", requireAuth, requireAdmin, async (request, response, next) => {
    try {
      const { commands } = request.body as { commands?: unknown };
      if (!Array.isArray(commands)) {
        throw new HttpError(400, "Import must include a commands array.");
      }
      const parsedCommands = commands.map(parseVoiceCommandInput);
      const savedCommands = await repositories.voiceCommands.replaceAll(parsedCommands);
      response.json({ commands: savedCommands.map(serializeVoiceCommand) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/voice-commands/:commandId/run", requireAuth, async (request, response, next) => {
    try {
      const command = await repositories.voiceCommands.findById(String(request.params.commandId));
      if (!command) {
        throw new HttpError(404, "Voice command not found.");
      }
      const { dryRun } = request.body as { dryRun?: boolean };
      const result = await runVoiceCommand(command, dryRun !== false);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/local/voice-commands", async (request, response, next) => {
    try {
      if (!isLocalRequest(request)) {
        throw new HttpError(403, "Local voice command helper requests must come from this Mac.");
      }
      const commands = await repositories.voiceCommands.list();
      response.json({ commands: commands.filter((command) => command.enabled).map(serializeVoiceCommand) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/local/voice-commands/run", async (request, response, next) => {
    try {
      if (!isLocalRequest(request)) {
        throw new HttpError(403, "Local voice command helper requests must come from this Mac.");
      }
      const { voicePhrase, dryRun } = request.body as { voicePhrase?: string; dryRun?: boolean };
      if (!voicePhrase) {
        throw new HttpError(400, "Voice phrase is required.");
      }
      const command = await findVoiceCommandByPhrase(repositories, voicePhrase);
      if (!command) {
        throw new HttpError(404, "No enabled voice command matched that phrase.");
      }
      const result = await runVoiceCommand(command, dryRun === true);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/meeting-rooms", requireAuth, async (_request, response, next) => {
    try {
      const rooms = await repositories.meetingRooms.list();
      response.json({ rooms: rooms.map(serializeMeetingRoom) });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/meeting-rooms/:roomId", requireAuth, requireAdmin, async (request, response, next) => {
    try {
      const roomId = parseMeetingRoomId(request.params.roomId);
      const input = parseMeetingRoomInput(request.body);
      const room = await repositories.meetingRooms.update(roomId, input);
      if (!room) {
        throw new HttpError(404, "Meeting room not found.");
      }
      response.json({ room: serializeMeetingRoom(room) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/meeting-rooms/:roomId/join", requireAuth, async (request, response, next) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      const storedUser = await repositories.users.findById(user.id);
      const room = await repositories.meetingRooms.join(parseMeetingRoomId(request.params.roomId), {
        userId: user.id,
        email: user.email,
        name: storedUser?.name,
        joinedAt: new Date().toISOString(),
      });
      if (!room) {
        throw new HttpError(404, "Meeting room not found.");
      }
      response.json({ room: serializeMeetingRoom(room) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/meeting-rooms/:roomId/leave", requireAuth, async (request, response, next) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      const room = await repositories.meetingRooms.leave(parseMeetingRoomId(request.params.roomId), user.id);
      if (!room) {
        throw new HttpError(404, "Meeting room not found.");
      }
      response.json({ room: serializeMeetingRoom(room) });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/meeting-rooms/:roomId/miro-board", requireAuth, async (request, response, next) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      const storedUser = await repositories.users.findById(user.id);
      const input = parseMeetingRoomBoardInput(request.body);
      const room = await repositories.meetingRooms.shareBoard(parseMeetingRoomId(request.params.roomId), {
        url: input.url,
        sharedByUserId: user.id,
        sharedByEmail: user.email,
        sharedByName: storedUser?.name,
        sharedAt: new Date().toISOString(),
      });
      if (!room) {
        throw new HttpError(404, "Meeting room not found.");
      }
      response.json({ room: serializeMeetingRoom(room) });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/meeting-rooms/:roomId/miro-board", requireAuth, async (request, response, next) => {
    try {
      const room = await repositories.meetingRooms.clearBoard(parseMeetingRoomId(request.params.roomId));
      if (!room) {
        throw new HttpError(404, "Meeting room not found.");
      }
      response.json({ room: serializeMeetingRoom(room) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/jobs", requireAuth, async (request, response, next) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      const jobs = user.role === "admin" ? await repositories.jobs.listRecent() : await repositories.jobs.listForUser(user.id);
      const users = await Promise.all(jobs.map((job) => repositories.users.findById(job.userId)));
      response.json({ jobs: jobs.map((job, index) => serializeJobWithUser(job, users[index])) });
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
      const job = await findJobForRequestUser(repositories, jobId, user);
      if (!job) {
        throw new HttpError(404, "Job not found.");
      }

      if (job.generatedImages.length === 1) {
        const image = job.generatedImages[0];
        const stream = await objectStore.getReadStream(image.key);
        const fileName = path.basename(image.originalFileName ?? image.key);
        response.setHeader("Content-Type", image.contentType);
        response.setHeader("Content-Disposition", `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        stream.pipe(response);
        return;
      }

      if (!job.zipFile) {
        throw new HttpError(404, "The download file is not available.");
      }

      const stream = await objectStore.getReadStream(job.zipFile.key);
      response.setHeader("Content-Type", "application/zip");
      response.setHeader("Content-Disposition", 'attachment; filename="miro_converted_jpegs.zip"');
      stream.pipe(response);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/jobs/:jobId/images/:imageName", requireAuth, async (request, response, next) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      const jobId = String(request.params.jobId);
      const job = await findJobForRequestUser(repositories, jobId, user);
      if (!job) {
        throw new HttpError(404, "Job not found.");
      }

      const imageName = String(request.params.imageName);
      const image = job.generatedImages.find((item) => path.basename(item.key) === imageName || item.originalFileName === imageName);
      if (!image) {
        throw new HttpError(404, "The generated image is not available.");
      }

      const stream = await objectStore.getReadStream(image.key);
      response.setHeader("Content-Type", image.contentType);
      response.setHeader("Content-Disposition", `inline; filename="${path.basename(image.originalFileName ?? image.key)}"`);
      stream.pipe(response);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/jobs/:jobId", requireAuth, async (request, response, next) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      const jobId = String(request.params.jobId);
      const job = await findJobForRequestUser(repositories, jobId, user);
      if (!job) {
        throw new HttpError(404, "Job not found.");
      }
      await repositories.jobs.delete(jobId);
      response.json({ message: "Job deleted." });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/version", async (_request, response, next) => {
    try {
      const info = await loadBuildInfo();
      response.json({ version: info.version, gitSha: info.gitSha, generatedAt: info.generatedAt });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/release-notes", async (_request, response, next) => {
    try {
      const info = await loadBuildInfo();
      response.json({ entries: info.entries });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sessions", async (_request, response, next) => {
    try {
      const sessions = await loadSessions();
      response.json({ sessions });
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

function serializeJobWithUser(job: JobRecord, user: UserRecord | null): ConversionJob {
  return {
    ...serializeJob(job),
    user: user ? {
      id: user._id,
      email: user.email,
      name: user.name,
    } : undefined,
  };
}

function parseMeetingRoomId(value: unknown): MeetingRoomId {
  if (value === "call-hangout-1" || value === "call-hangout-2" || value === "call-hangout-3") {
    return value;
  }
  throw new HttpError(404, "Meeting room not found.");
}

function parseMeetingRoomInput(value: unknown): MeetingRoomInput {
  if (!isObjectRecord(value)) {
    throw new HttpError(400, "Meeting room update must be an object.");
  }
  return {
    meetUrl: optionalExternalUrl(value.meetUrl) ?? "",
  };
}

function parseMeetingRoomBoardInput(value: unknown): MeetingRoomBoardInput {
  if (!isObjectRecord(value)) {
    throw new HttpError(400, "Miro board must be an object.");
  }
  const url = requiredExternalUrl(value.url, "Miro board URL is required.");
  const host = new URL(url).hostname.toLowerCase();
  if (!host.endsWith("miro.com")) {
    throw new HttpError(400, "Miro board URL must be a miro.com link.");
  }
  return { url };
}

function parseVoiceCommandInput(value: unknown): VoiceCommandInput {
  if (!isObjectRecord(value)) {
    throw new HttpError(400, "Voice command must be an object.");
  }

  const id = optionalString(value.id);
  const enabled = booleanValue(value.enabled, true);
  const voicePhrase = requiredString(value.voicePhrase, "Voice phrase is required.");
  const targetApp = requiredString(value.targetApp, "Target app is required.");
  const actionType = requiredString(value.actionType, "Action type is required.");
  const key = optionalString(value.key) ?? "";
  const macroName = optionalString(value.macroName) ?? "";
  const notes = optionalString(value.notes) ?? "";
  const modifiers = parseModifiers(value.modifiers);

  if (!isVoiceCommandTargetApp(targetApp)) {
    throw new HttpError(400, "Target app is not supported.");
  }
  if (!isVoiceCommandActionType(actionType)) {
    throw new HttpError(400, "Action type is not supported.");
  }
  if (actionType === "shortcut" && !key.trim()) {
    throw new HttpError(400, "Shortcut commands require a key.");
  }

  return normaliseVoiceCommandInput({
    id,
    enabled,
    voicePhrase,
    targetApp,
    actionType,
    key,
    modifiers,
    macroName,
    notes,
  });
}

function parsePartialVoiceCommandInput(value: unknown): Partial<VoiceCommandInput> {
  if (!isObjectRecord(value)) {
    throw new HttpError(400, "Voice command update must be an object.");
  }

  const input: Partial<VoiceCommandInput> = {};
  if (value.id !== undefined) input.id = optionalString(value.id);
  if (value.enabled !== undefined) input.enabled = booleanValue(value.enabled, true);
  if (value.voicePhrase !== undefined) input.voicePhrase = requiredString(value.voicePhrase, "Voice phrase is required.");
  if (value.targetApp !== undefined) {
    const targetApp = requiredString(value.targetApp, "Target app is required.");
    if (!isVoiceCommandTargetApp(targetApp)) {
      throw new HttpError(400, "Target app is not supported.");
    }
    input.targetApp = targetApp;
  }
  if (value.actionType !== undefined) {
    const actionType = requiredString(value.actionType, "Action type is required.");
    if (!isVoiceCommandActionType(actionType)) {
      throw new HttpError(400, "Action type is not supported.");
    }
    input.actionType = actionType;
  }
  if (value.key !== undefined) input.key = optionalString(value.key) ?? "";
  if (value.modifiers !== undefined) input.modifiers = parseModifiers(value.modifiers);
  if (value.macroName !== undefined) input.macroName = optionalString(value.macroName) ?? "";
  if (value.notes !== undefined) input.notes = optionalString(value.notes) ?? "";
  return input;
}

async function runVoiceCommand(command: VoiceCommandRecord, dryRun: boolean): Promise<VoiceCommandRunResult> {
  if (!command.enabled) {
    throw new HttpError(400, "This voice command is disabled.");
  }
  if (command.actionType !== "shortcut") {
    throw new HttpError(400, "Only shortcut voice commands can run in version 1.");
  }
  const appleScript = appleScriptForCommand(command);
  if (!dryRun) {
    try {
      await execFileAsync("osascript", ["-e", appleScript]);
    } catch (error) {
      throw new HttpError(400, appleScriptErrorMessage(error, command.targetApp));
    }
  }
  return {
    command: serializeVoiceCommand(command),
    appleScript,
    dryRun,
    message: dryRun ? "Dry run complete. No keystroke was sent." : "Shortcut sent.",
  };
}

async function findVoiceCommandByPhrase(repositories: Repositories, voicePhrase: string): Promise<VoiceCommandRecord | null> {
  const normalisedPhrase = voicePhrase.trim().toLowerCase();
  const commands = await repositories.voiceCommands.list();
  return commands.find((command) => command.enabled && command.voicePhrase.trim().toLowerCase() === normalisedPhrase) ?? null;
}

function isLocalRequest(request: Request): boolean {
  const ip = (request.ip ?? "").replace("::ffff:", "");
  return ip === "::1" || ip === "127.0.0.1" || ip === "localhost";
}

function appleScriptErrorMessage(error: unknown, targetApp: string): string {
  const message = isObjectRecord(error) && typeof error.message === "string" ? error.message : "";
  if (message.includes("No open Vectorworks application was found")) {
    return "No open Vectorworks application was found. Open your Vectorworks version, then run the command again.";
  }
  if (message.includes("Can’t get application") || message.includes("Can't get application")) {
    return `macOS could not find ${targetApp}. Check the target app name or choose the installed Vectorworks version.`;
  }
  return "macOS could not run the shortcut. Check Accessibility permissions for the local server process.";
}

function appleScriptForCommand(command: VoiceCommandRecord): string {
  const modifierScript = command.modifiers.length ? ` using {${command.modifiers.map(appleScriptModifier).join(", ")}}` : "";
  const keyCommand = appleScriptKeyCommand(command.key, modifierScript);
  if (command.targetApp.startsWith("Vectorworks")) {
    return [
      "tell application \"System Events\"",
      "  set vectorworksProcesses to every process whose name starts with \"Vectorworks\" and name does not contain \"Cloud\" and name does not contain \"Package\" and name does not contain \"Install\" and name does not contain \"Updater\"",
      "  if (count of vectorworksProcesses) is 0 then error \"No open Vectorworks application was found.\"",
      "  set frontmost of item 1 of vectorworksProcesses to true",
      "  delay 0.2",
      `  ${keyCommand}`,
      "end tell",
    ].join("\n");
  }
  const appName = escapeAppleScriptString(command.targetApp);
  return `tell application "${appName}" to activate\ntell application "System Events" to ${keyCommand}`;
}

function appleScriptKeyCommand(key: string, modifierScript: string): string {
  const keyCode = keyCodeForShortcutKey(key);
  if (keyCode !== undefined) {
    return `key code ${keyCode}${modifierScript}`;
  }
  return `keystroke "${escapeAppleScriptString(key)}"${modifierScript}`;
}

function keyCodeForShortcutKey(key: string): number | undefined {
  const normalised = key.trim().toLowerCase();
  const topRowCodes: Record<string, number> = {
    "0": 29,
    "1": 18,
    "2": 19,
    "3": 20,
    "4": 21,
    "5": 23,
    "6": 22,
    "7": 26,
    "8": 28,
    "9": 25,
  };
  const keypadCodes: Record<string, number> = {
    "0": 82,
    "1": 83,
    "2": 84,
    "3": 85,
    "4": 86,
    "5": 87,
    "6": 88,
    "7": 89,
    "8": 91,
    "9": 92,
  };
  const keypadMatch = /^(?:numpad|keypad|numeric)\s*([0-9])$/.exec(normalised);
  if (keypadMatch?.[1]) {
    return keypadCodes[keypadMatch[1]];
  }
  return topRowCodes[normalised];
}

function appleScriptModifier(modifier: VoiceCommandModifier): string {
  return `${modifier} down`;
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function parseModifiers(value: unknown): VoiceCommandModifier[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new HttpError(400, "Modifiers must be a list.");
  }
  return value.map((item) => {
    if (typeof item !== "string" || !isVoiceCommandModifier(item)) {
      throw new HttpError(400, "Modifier is not supported.");
    }
    return item;
  });
}

function requiredString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, message);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new HttpError(400, "Expected text value.");
  }
  return value;
}

function requiredExternalUrl(value: unknown, message: string): string {
  const url = optionalExternalUrl(value);
  if (!url) {
    throw new HttpError(400, message);
  }
  return url;
}

function optionalExternalUrl(value: unknown): string | undefined {
  const text = optionalString(value)?.trim();
  if (!text) return undefined;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new HttpError(400, "URL must be valid.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HttpError(400, "URL must start with http or https.");
  }
  return url.toString();
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new HttpError(400, "Expected true or false value.");
  }
  return value;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findJobForRequestUser(repositories: Repositories, jobId: string, user: AuthenticatedRequest["user"]): Promise<JobRecord | null> {
  if (user.role === "admin") {
    return repositories.jobs.findById(jobId);
  }
  return repositories.jobs.findByIdForUser(jobId, user.id);
}
