import type { AdminUser, ConversionJob, UserRole, UserSession } from "../../shared/types";

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
    throw new Error(body.error ?? "Request failed.");
  }

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

export async function downloadJobZip(token: string, jobId: string): Promise<void> {
  const response = await fetch(`/api/jobs/${jobId}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: "Download failed." }))) as { error?: string };
    throw new Error(body.error ?? "Download failed.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "miro_converted_jpegs.zip";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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

export function createMagicLink(token: string, userId: string): Promise<{ magicLink: string; expiresAt: string }> {
  return apiFetch<{ magicLink: string; expiresAt: string }>(`/api/admin/users/${userId}/magic-link`, {
    method: "POST",
    token,
  });
}
