export type PaperSize = "A1" | "A2" | "A3" | "A4";
export type Orientation = "Landscape" | "Portrait";
export type DrawingScale = "1:1000" | "1:500" | "1:250" | "1:200" | "1:100" | "1:50" | "1:25" | "1:20";
export type JobStatus = "pending" | "processing" | "completed" | "failed";
export type UserRole = "admin" | "user";
export type VoiceCommandActionType = "shortcut" | "macro" | "script";
export type VoiceCommandTargetApp = "Vectorworks" | "Vectorworks 2026" | "Vectorworks 2025" | "Miro" | "Chrome" | "Finder" | "Other";
export type VoiceCommandModifier = "command" | "shift" | "option" | "control";
export type MeetingRoomId = "call-hangout-1" | "call-hangout-2" | "call-hangout-3";

export interface ConversionSettings {
  paperSize: PaperSize;
  orientation: Orientation;
  drawingScale: DrawingScale;
}

export interface StoredObject {
  bucket: string;
  key: string;
  originalFileName?: string;
  contentType: string;
  sizeBytes?: number;
}

export interface JobUser {
  id: string;
  email: string;
  name?: string;
}

export interface ConversionJob {
  _id: string;
  userId: string;
  user?: JobUser;
  status: JobStatus;
  paperSize: PaperSize;
  orientation: Orientation;
  drawingScale: DrawingScale;
  targetPixelWidth: number;
  sourceFiles: StoredObject[];
  generatedImages: StoredObject[];
  zipFile?: StoredObject;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface UserSession {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string;
    role: UserRole;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceCommand {
  id: string;
  enabled: boolean;
  voicePhrase: string;
  targetApp: VoiceCommandTargetApp;
  actionType: VoiceCommandActionType;
  key: string;
  modifiers: VoiceCommandModifier[];
  macroName: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VoiceCommandInput {
  id?: string;
  enabled: boolean;
  voicePhrase: string;
  targetApp: VoiceCommandTargetApp;
  actionType: VoiceCommandActionType;
  key: string;
  modifiers: VoiceCommandModifier[];
  macroName: string;
  notes: string;
}

export interface VoiceCommandRunResult {
  command: VoiceCommand;
  appleScript: string;
  dryRun: boolean;
  message: string;
}

export interface MeetingRoomParticipant {
  userId: string;
  email: string;
  name?: string;
  joinedAt: string;
}

export interface MeetingRoomBoard {
  url: string;
  sharedByUserId: string;
  sharedByEmail: string;
  sharedByName?: string;
  sharedAt: string;
}

export interface MeetingRoom {
  id: MeetingRoomId;
  name: string;
  teamspeakChannelName: string;
  meetUrl: string;
  miroBoard?: MeetingRoomBoard;
  participants: MeetingRoomParticipant[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MeetingRoomInput {
  meetUrl: string;
}

export interface MeetingRoomBoardInput {
  url: string;
}

export interface ApiError {
  error: string;
}
