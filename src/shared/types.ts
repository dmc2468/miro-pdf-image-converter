export type PaperSize = "A3" | "A4";
export type Orientation = "Landscape" | "Portrait";
export type DrawingScale = "1:100" | "1:50" | "1:25" | "1:20";
export type JobStatus = "pending" | "processing" | "completed" | "failed";
export type UserRole = "admin" | "user";

export type ConversionSettings = {
  paperSize: PaperSize;
  orientation: Orientation;
  drawingScale: DrawingScale;
};

export type StoredObject = {
  bucket: string;
  key: string;
  originalFileName?: string;
  contentType: string;
  sizeBytes?: number;
};

export type ConversionJob = {
  _id: string;
  userId: string;
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
};

export type UserSession = {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string;
    role: UserRole;
  };
};

export type AdminUser = {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type ApiError = {
  error: string;
};
