import type { AdminUser, ConversionJob, UserRole, UserSession } from "../../shared/types";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: "Request failed." }))) as { error?: string };
    throw new ApiRequestError(body.error ?? "Request failed.", response.status);
  }

  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

export function login(email: string, password: string): Promise<UserSession> {
  return apiFetch<UserSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function loginWithMagicLink(token: string, password?: string): Promise<UserSession> {
  return apiFetch<UserSession>("/api/auth/magic-link", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export function listJobs(token: string): Promise<{ jobs: ConversionJob[] }> {
  return apiFetch<{ jobs: ConversionJob[] }>("/api/jobs", { token });
}

export function createJob(token: string, formData: FormData): Promise<{ job: ConversionJob; downloadUrl: string }> {
  return apiFetch<{ job: ConversionJob; downloadUrl: string }>("/api/jobs", {
    method: "POST",
    token,
    body: formData,
  });
}

function fileNameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const quotedMatch = /filename="([^"]+)"/i.exec(header);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const plainMatch = /filename=([^;]+)/i.exec(header);
  return plainMatch?.[1]?.trim() ?? null;
}

export async function downloadJobOutput(token: string, jobId: string): Promise<void> {
  const response = await fetch(`/api/jobs/${jobId}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: "Download failed." }))) as { error?: string };
    throw new ApiRequestError(body.error ?? "Download failed.", response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileNameFromContentDisposition(response.headers.get("Content-Disposition")) ?? "miro_converted_output";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function jobImageObjectUrl(token: string, jobId: string, imageName: string): Promise<string> {
  const response = await fetch(`/api/jobs/${jobId}/images/${encodeURIComponent(imageName)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: "Image preview failed." }))) as { error?: string };
    throw new ApiRequestError(body.error ?? "Image preview failed.", response.status);
  }

  return URL.createObjectURL(await response.blob());
}

export function listUsers(token: string): Promise<{ users: AdminUser[] }> {
  return apiFetch<{ users: AdminUser[] }>("/api/admin/users", { token });
}

export function createUser(token: string, input: { email: string; name?: string; role: UserRole }): Promise<{ user: AdminUser }> {
  return apiFetch<{ user: AdminUser }>("/api/admin/users", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export function updateUser(token: string, userId: string, input: { name?: string; role?: UserRole }): Promise<{ user: AdminUser }> {
  return apiFetch<{ user: AdminUser }>(`/api/admin/users/${userId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });
}

export function changePassword(token: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/api/auth/password", {
    method: "PATCH",
    token,
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function deleteJob(token: string, jobId: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/jobs/${jobId}`, {
    method: "DELETE",
    token,
  });
}

export function createMagicLink(token: string, userId: string): Promise<{ magicLink: string; expiresAt: string }> {
  return apiFetch<{ magicLink: string; expiresAt: string }>(`/api/admin/users/${userId}/magic-link`, {
    method: "POST",
    token,
  });
}

export function deleteUser(token: string, userId: string): Promise<void> {
  return apiFetch<void>(`/api/admin/users/${userId}`, { method: "DELETE", token });
}

export interface ReleaseEntry {
  sha: string;
  author: string;
  date: string;
  subject: string;
  body: string;
}

export function fetchReleaseNotes(): Promise<{ entries: ReleaseEntry[] }> {
  return apiFetch<{ entries: ReleaseEntry[] }>("/api/release-notes");
}

export function fetchVersion(): Promise<{ version: string; gitSha: string; generatedAt: string }> {
  return apiFetch<{ version: string; gitSha: string; generatedAt: string }>("/api/version");
}
