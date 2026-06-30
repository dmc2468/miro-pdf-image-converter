export type PaperSize = "A3" | "A4";
export type Orientation = "Landscape" | "Portrait";
export type DrawingScale = "1:500" | "1:250" | "1:200" | "1:100" | "1:50" | "1:25" | "1:20";
export type JobStatus = "pending" | "processing" | "completed" | "failed";
export type UserRole = "admin" | "user";

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

export interface ApiError {
  error: string;
}
