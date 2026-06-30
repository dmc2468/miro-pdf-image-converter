import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Download,
  FileArchive,
  FileText,
  Image,
  KeyRound,
  Link,
  LogOut,
  RefreshCw,
  Shield,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { DRAWING_SCALES, ORIENTATIONS, PAPER_SIZES, getTargetPixelWidth } from "../../shared/scaling";
import type { AdminUser, ConversionJob, DrawingScale, Orientation, PaperSize, UserRole, UserSession } from "../../shared/types";
import { ApiRequestError, changePassword, createJob, createMagicLink, createUser, deleteJob, deleteUser, downloadJobZip, jobImageObjectUrl, listJobs, listUsers, login, loginWithMagicLink, updateUser } from "./api";

const SESSION_KEY = "studio-mcleod-session";

type Module = "miro-converter" | "admin-users";

function currentModule(): Module {
  if (window.location.pathname.startsWith("/admin/users")) return "admin-users";
  return "miro-converter";
}

export function App() {
  const [session, setSession] = useState<UserSession | null>(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as UserSession;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  });
  const [activeModule, setActiveModule] = useState<Module>(currentModule);

  useEffect(() => {
    const onPopState = () => setActiveModule(currentModule());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigateTo(module: Module) {
    const path = module === "admin-users" ? "/admin/users" : "/miro-converter";
    window.history.pushState(null, "", path);
    setActiveModule(module);
  }

  function storeSession(nextSession: UserSession) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  function expireSession() {
    logout();
    window.history.replaceState(null, "", "/miro-converter");
  }

  if (window.location.pathname.startsWith("/magic-link")) {
    return <MagicLinkPage onSession={storeSession} />;
  }

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      {session ? (
        <>
          <Sidebar
            activeModule={activeModule}
            role={session.user.role}
            email={session.user.email}
            token={session.token}
            onNavigate={navigateTo}
            onLogout={logout}
          />
          <main className="flex-1 overflow-auto">
            {activeModule === "admin-users" && session.user.role === "admin" ? (
              <AdminUsersPanel token={session.token} currentUserId={session.user.id} onSessionExpired={expireSession} />
            ) : (
              <MiroConverterModule session={session} onSessionExpired={expireSession} />
            )}
          </main>
        </>
      ) : (
        <main className="flex-1">
          <AuthPanel onSession={storeSession} />
        </main>
      )}
    </div>
  );
}

type ModuleItem = {
  id: Module;
  label: string;
  icon: typeof Image;
};

const modules: ModuleItem[] = [
  { id: "miro-converter", label: "Miro converter", icon: Image },
];

function Sidebar({
  activeModule,
  role,
  email,
  token,
  onNavigate,
  onLogout,
}: {
  activeModule: Module;
  role: UserRole;
  email: string;
  token: string;
  onNavigate: (module: Module) => void;
  onLogout: () => void;
}) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  function resetPasswordForm() {
    setShowPasswordForm(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordSuccess(null);
  }

  async function submitPasswordChange() {
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 10) {
      setPasswordError("New password must be at least 10 characters.");
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await changePassword(token, currentPassword, newPassword);
      setPasswordSuccess(result.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Could not change password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <aside className="flex w-64 flex-col border-r border-line bg-white">
      <div className="flex items-center gap-3 border-b border-line px-5 py-5">
        <img src="/logo.jpg" alt="Studio McLeod" className="h-8 w-auto" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Studio McLeod</p>
          <p className="truncate text-xs text-muted">Private tools</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">Modules</p>
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.id}
              type="button"
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                activeModule === mod.id
                  ? "bg-ink text-white"
                  : "text-muted hover:bg-stone-100 hover:text-ink"
              }`}
              onClick={() => onNavigate(mod.id)}
            >
              <Icon size={18} />
              {mod.label}
            </button>
          );
        })}

        {role === "admin" ? (
          <>
            <p className="mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-muted">Administration</p>
            <button
              type="button"
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                activeModule === "admin-users"
                  ? "bg-ink text-white"
                  : "text-muted hover:bg-stone-100 hover:text-ink"
              }`}
              onClick={() => onNavigate("admin-users")}
            >
              <Users size={18} />
              Users
            </button>
          </>
        ) : null}
      </nav>

      <div className="border-t border-line">
        <button
          type="button"
          className={`flex w-full items-center gap-3 px-5 py-3 text-sm font-medium transition ${
            showPasswordForm
              ? "bg-stone-50 text-ink"
              : "text-muted hover:bg-stone-50 hover:text-ink"
          }`}
          onClick={() => setShowPasswordForm(!showPasswordForm)}
        >
          <KeyRound size={16} />
          Change password
        </button>

        {showPasswordForm ? (
          <div className="border-t border-line px-4 py-4 space-y-3">
            <label className="field-label">
              Current password
              <input
                className="field-input"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label className="field-label">
              New password
              <input
                className="field-input"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label className="field-label">
              Confirm new password
              <input
                className="field-input"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            {passwordError ? <p className="text-xs text-red-700">{passwordError}</p> : null}
            {passwordSuccess ? <p className="text-xs text-green-700">{passwordSuccess}</p> : null}
            <div className="flex gap-2">
              <button
                className="primary-button flex-1"
                type="button"
                disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}
                onClick={() => void submitPasswordChange()}
              >
                {passwordBusy ? <RefreshCw className="animate-spin" size={16} /> : null}
                Save
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={resetPasswordForm}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="border-t border-line px-3 py-4">
          <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-muted">
            <span className="truncate">{email}</span>
            <button
              type="button"
              title="Log out"
              className="shrink-0 rounded p-1 transition hover:bg-stone-100 hover:text-ink"
              onClick={onLogout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function AuthPanel({ onSession }: { onSession: (session: UserSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onSession(await login(email, password));
      window.history.replaceState(null, "", "/miro-converter");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <img src="/logo.jpg" alt="Studio McLeod" className="mx-auto mb-4 h-10 w-auto" />
          <h1 className="text-xl font-semibold text-ink">Studio McLeod</h1>
          <p className="mt-1 text-sm text-muted">Sign in to access private tools</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <label className="field-label">
              Email
              <input className="field-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="field-label">
              Password
              <input className="field-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {error ? <Alert message={error} onDismiss={() => setError(null)} /> : null}
            <button className="primary-button w-full" type="button" disabled={busy} onClick={submit}>
              {busy ? <RefreshCw className="animate-spin" size={18} /> : null}
              Sign in
            </button>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Studio McLeod Architecture Ltd &middot; Private tools for the studio team
        </p>
      </div>
    </div>
  );
}

function MagicLinkPage({ onSession }: { onSession: (session: UserSession) => void }) {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(usePassword: boolean) {
    setBusy(true);
    setError(null);
    try {
      const session = await loginWithMagicLink(token, usePassword ? password : undefined);
      onSession(session);
      window.history.replaceState(null, "", "/miro-converter");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Magic link failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <img src="/logo.jpg" alt="Studio McLeod" className="mx-auto mb-4 h-10 w-auto" />
          <h1 className="text-xl font-semibold text-ink">Studio McLeod</h1>
          <p className="mt-1 text-sm text-muted">Use this one-time link to sign in</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
          <label className="field-label">
            New password
            <input className="field-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <div className="mt-4"><Alert message={error} onDismiss={() => setError(null)} /></div> : null}
          <div className="mt-5 flex flex-col gap-3">
            <button className="primary-button" type="button" disabled={busy || password.length < 10} onClick={() => void submit(true)}>
              Set password and sign in
            </button>
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void submit(false)}>
              Sign in once
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiroConverterModule({ session, onSessionExpired }: { session: UserSession; onSessionExpired: () => void }) {
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [paperSize, setPaperSize] = useState<PaperSize>("A3");
  const [orientation, setOrientation] = useState<Orientation>("Landscape");
  const [drawingScale, setDrawingScale] = useState<DrawingScale>("1:100");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const targetWidth = useMemo(
    () => getTargetPixelWidth(paperSize, orientation, drawingScale),
    [drawingScale, orientation, paperSize],
  );

  useEffect(() => {
    void refreshJobs();
  }, []);

  async function refreshJobs() {
    setJobsLoading(true);
    try {
      const result = await listJobs(session.token);
      setJobs(result.jobs);
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not load recent jobs.");
    } finally {
      setJobsLoading(false);
    }
  }

  async function submitConversion() {
    if (selectedFiles.length === 0) {
      setMessage("Select at least one PDF.");
      return;
    }

    const formData = new FormData();
    for (const file of selectedFiles) formData.append("files", file);
    formData.append("paperSize", paperSize);
    formData.append("orientation", orientation);
    formData.append("drawingScale", drawingScale);

    setBusy(true);
    setMessage(null);
    try {
      const result = await createJob(session.token, formData);
      setJobs((current) => [result.job, ...current.filter((job) => job._id !== result.job._id)]);
      setSelectedFiles([]);
      await downloadJobZip(session.token, result.job._id);
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Conversion failed.");
      await refreshJobs();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-ink">Miro converter</h2>
        <p className="text-sm text-muted">Convert architectural PDF drawings into correctly scaled JPEG images for importing into Miro.</p>
      </div>
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <ConverterPanel
          busy={busy}
          drawingScale={drawingScale}
          message={message}
          orientation={orientation}
          paperSize={paperSize}
          selectedFiles={selectedFiles}
          targetWidth={targetWidth}
          onFiles={setSelectedFiles}
          onPaperSize={setPaperSize}
          onOrientation={setOrientation}
          onDrawingScale={setDrawingScale}
          onSubmit={submitConversion}
          onDismissMessage={() => setMessage(null)}
        />
        <JobsPanel jobs={jobs} loading={jobsLoading} token={session.token} onRefresh={() => void refreshJobs()} onDelete={(id) => deleteJob(session.token, id).then(() => refreshJobs())} onError={setMessage} onSessionExpired={onSessionExpired} />
      </section>
    </div>
  );
}

function AdminUsersPanel({ token, currentUserId, onSessionExpired }: { token: string; currentUserId: string; onSessionExpired: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshUsers();
  }, []);

  async function refreshUsers() {
    setUsersLoading(true);
    try {
      const result = await listUsers(token);
      setUsers(result.users);
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not load users.");
    } finally {
      setUsersLoading(false);
    }
  }

  async function submitUser() {
    setBusy(true);
    setMessage(null);
    setMagicLink(null);
    try {
      const result = await createUser(token, { email, name, role });
      setUsers((current) => [result.user, ...current]);
      setEmail("");
      setName("");
      setRole("user");
      const linkResult = await createMagicLink(token, result.user.id);
      setMagicLink(linkResult.magicLink);
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not create user.");
    } finally {
      setBusy(false);
    }
  }

  async function generateLink(userId: string) {
    setMessage(null);
    try {
      const result = await createMagicLink(token, userId);
      setMagicLink(result.magicLink);
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not create magic link.");
    }
  }

  async function changeRole(user: AdminUser, nextRole: UserRole) {
    try {
      const result = await updateUser(token, user.id, { role: nextRole });
      setUsers((current) => current.map((item) => (item.id === user.id ? result.user : item)));
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not update user.");
    }
  }

  async function removeUser(userId: string) {
    setMessage(null);
    try {
      await deleteUser(token, userId);
      setUsers((current) => current.filter((item) => item.id !== userId));
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not delete user.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-ink">User management</h2>
        <p className="text-sm text-muted">Create and manage Studio McLeod team members.</p>
      </div>
      <section className="grid gap-6 lg:grid-cols-[minmax(360px,0.45fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-line bg-white p-5">
          <div className="mb-4 flex items-center gap-3">
            <Shield className="text-blue" size={20} />
            <h2 className="text-base font-semibold">Create user</h2>
          </div>
          <div className="space-y-4">
            <label className="field-label">
              Email
              <input className="field-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="field-label">
              Name
              <input className="field-input" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <SelectField label="Role" value={role} values={["user", "admin"] as const} onChange={setRole} />
            <button className="primary-button w-full" type="button" disabled={busy || !email} onClick={() => void submitUser()}>
              {busy ? <RefreshCw className="animate-spin" size={18} /> : <Users size={18} />}
              Create and generate link
            </button>
            {message ? <Alert message={message} onDismiss={() => setMessage(null)} /> : null}
          </div>
          {magicLink ? <MagicLinkBox magicLink={magicLink} /> : null}
        </div>

        <div className="rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <h2 className="font-semibold">Users</h2>
            <button className="icon-only" type="button" title="Refresh users" onClick={() => void refreshUsers()}>
              <RefreshCw size={17} />
            </button>
          </div>
          <div className="divide-y divide-line">
            {usersLoading ? (
              <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-muted">
                <RefreshCw className="animate-spin" size={16} />
                Loading...
              </p>
            ) : users.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted">No users yet.</p>
            ) : (
              users.map((user) => (
              <div className="grid items-center gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_140px_minmax(0,auto)]" key={user.id}>
                <div className="min-w-0 self-center">
                  <p className="truncate text-sm font-semibold">{user.email}</p>
                  <p className="mt-1 truncate text-xs text-muted">{user.name || "No name"} · created {new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
                <select className="h-9 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none" value={user.role} onChange={(event) => void changeRole(user, event.target.value as UserRole)}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
                <div className="flex items-center gap-2">
                  <button className="secondary-button h-9" type="button" onClick={() => void generateLink(user.id)}>
                    <Link size={16} />
                    Magic link
                  </button>
                  <button className="icon-only h-9 w-9 text-red-500 disabled:opacity-30" type="button" title="Delete user" disabled={user.id === currentUserId} onClick={() => void removeUser(user.id)}>
                    <X size={17} />
                  </button>
                </div>
              </div>
            )))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MagicLinkBox({ magicLink }: { magicLink: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(magicLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mt-5 rounded-lg border border-blue/20 bg-blue/5 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue">Share this one-time link</p>
      <p className="break-all text-sm text-ink">{magicLink}</p>
      <button className="secondary-button mt-3" type="button" onClick={() => void copy()}>
        <Copy size={16} />
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

function ConverterPanel(props: {
  busy: boolean;
  drawingScale: DrawingScale;
  message: string | null;
  orientation: Orientation;
  paperSize: PaperSize;
  selectedFiles: File[];
  targetWidth: number;
  onFiles: (files: File[]) => void;
  onPaperSize: (value: PaperSize) => void;
  onOrientation: (value: Orientation) => void;
  onDrawingScale: (value: DrawingScale) => void;
  onSubmit: () => void;
  onDismissMessage: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  function addFiles(files: FileList | null) {
    if (!files) return;
    props.onFiles([...files].filter((file) => file.name.toLowerCase().endsWith(".pdf")));
  }

  return (
    <div className="space-y-5">
      <section
        className={`upload-zone ${dragging ? "upload-zone-active" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <UploadCloud size={34} />
        <div>
          <p className="text-sm text-muted">Drop PDFs here or choose them from disk.</p>
        </div>
        <label className="secondary-button cursor-pointer">
          <FileText size={18} />
          Choose files
          <input className="hidden" type="file" accept="application/pdf" multiple onChange={(event) => addFiles(event.target.files)} />
        </label>
      </section>

      {props.selectedFiles.length ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-white">
            {props.selectedFiles.map((file) => (
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0" key={`${file.name}-${file.size}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="shrink-0 text-blue" size={18} />
                  <span className="truncate text-sm font-medium">{file.name}</span>
                </div>
                <span className="shrink-0 text-xs text-muted">{Math.ceil(file.size / 1024)} KB</span>
              </div>
            ))}
          </div>
          <PdfPreview file={props.selectedFiles[0]} />
        </div>
      ) : null}

      <section className="rounded-xl border border-line bg-white p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField label="Paper size" value={props.paperSize} values={PAPER_SIZES} onChange={props.onPaperSize} />
          <SelectField label="Orientation" value={props.orientation} values={ORIENTATIONS} onChange={props.onOrientation} />
          <SelectField label="Drawing scale" value={props.drawingScale} values={DRAWING_SCALES} onChange={props.onDrawingScale} />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <div>
            <p className="text-xs font-medium uppercase text-muted">Target pixel width</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{props.targetWidth}px</p>
          </div>
          <button className="primary-button w-full sm:w-auto" type="button" disabled={props.busy} onClick={props.onSubmit}>
            {props.busy ? <RefreshCw className="animate-spin" size={18} /> : <FileArchive size={18} />}
            Process
          </button>
        </div>
      </section>

      {props.message ? <Alert message={props.message} onDismiss={props.onDismissMessage} /> : null}
    </div>
  );
}

function PdfPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <FileText className="text-blue" size={16} />
        <p className="truncate text-xs font-semibold text-ink">{file.name}</p>
      </div>
      {url ? <iframe className="h-[500px] w-full bg-stone-50" src={`${url}#toolbar=0&navpanes=0`} title={file.name} /> : null}
    </div>
  );
}

function JobsPanel({
  jobs,
  loading,
  token,
  onRefresh,
  onDelete,
  onError,
  onSessionExpired,
}: {
  jobs: ConversionJob[];
  loading: boolean;
  token: string;
  onRefresh: () => void;
  onDelete: (jobId: string) => Promise<void>;
  onError: (message: string) => void;
  onSessionExpired: () => void;
}) {
  return (
    <aside className="rounded-xl border border-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="font-semibold text-sm">Recent jobs</h2>
        <button className="icon-only" type="button" title="Refresh jobs" onClick={onRefresh}>
          <RefreshCw size={17} />
        </button>
      </div>
      <div className="max-h-[calc(100vh-260px)] overflow-auto">
        {loading ? (
          <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-muted">
            <RefreshCw className="animate-spin" size={16} />
            Loading...
          </p>
        ) : jobs.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">No jobs yet.</p>
        ) : (
          jobs.map((job) => <JobRow job={job} token={token} onDelete={onDelete} onError={onError} onSessionExpired={onSessionExpired} key={job._id} />)
        )}
      </div>
    </aside>
  );
}

function JobRow({ job, token, onDelete, onError, onSessionExpired }: { job: ConversionJob; token: string; onDelete: (jobId: string) => Promise<void>; onError: (message: string) => void; onSessionExpired: () => void }) {
  const convertedBy = job.user?.name ?? job.user?.email ?? job.userId;
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(job._id);
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      onError(error instanceof Error ? error.message : "Could not delete job.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="border-b border-line px-5 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {job.paperSize} &middot; {job.orientation} &middot; {job.drawingScale}
          </p>
          <p className="mt-1 text-xs text-muted">{new Date(job.createdAt).toLocaleString()}</p>
          <p className="mt-1 truncate text-xs text-muted">Converted by {convertedBy}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`status status-${job.status}`}>{job.status}</span>
          <button
            type="button"
            title="Delete job"
            disabled={deleting}
            className="shrink-0 rounded p-1 text-muted transition hover:bg-stone-100 hover:text-red-700"
            onClick={() => void handleDelete()}
          >
            <X size={15} />
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span>{job.generatedImages.length} JPEGs</span>
        <span>{job.targetPixelWidth}px</span>
      </div>
      {job.status === "completed" && job.generatedImages.length ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {job.generatedImages.slice(0, 3).map((image) => (
            <GeneratedImagePreview
              imageName={image.originalFileName ?? image.key.split("/").at(-1) ?? image.key}
              jobId={job._id}
              token={token}
              key={image.key}
            />
          ))}
        </div>
      ) : null}
      {job.errorMessage ? <p className="mt-3 text-sm text-red-700">{job.errorMessage}</p> : null}
      {job.status === "completed" && job.zipFile ? (
        <button
          className="secondary-button mt-3 inline-flex"
          type="button"
          onClick={() => {
            void downloadJobZip(token, job._id).catch((error: unknown) => {
              onError(error instanceof Error ? error.message : "Download failed.");
              if (isUnauthorised(error)) onSessionExpired();
            });
          }}
        >
          <Download size={16} />
          Download ZIP
        </button>
      ) : null}
    </div>
  );
}

function GeneratedImagePreview({
  imageName,
  jobId,
  token,
}: {
  imageName: string;
  jobId: string;
  token: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;

    void jobImageObjectUrl(token, jobId, imageName)
      .then((nextUrl) => {
        objectUrl = nextUrl;
        if (active) setUrl(nextUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageName, jobId, token]);

  useEffect(() => {
    if (!showModal) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setShowModal(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showModal]);

  return (
    <>
      <div
        className="cursor-pointer overflow-hidden rounded-lg border border-line bg-stone-50"
        onClick={() => url && setShowModal(true)}
      >
        {url
          ? <img className="h-20 w-full object-contain" src={url} alt={imageName} />
          : failed
            ? <div className="flex h-20 w-full items-center justify-center bg-stone-100 text-xs text-muted">Unavailable</div>
            : <div className="h-20 w-full animate-pulse bg-stone-100" />}
        <p className="truncate border-t border-line bg-white px-2 py-1 text-[11px] text-muted">{imageName}</p>
      </div>

      {showModal && url ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowModal(false)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40"
            onClick={() => setShowModal(false)}
          >
            <X size={24} />
          </button>
          <img
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            src={url}
            alt={imageName}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}

function isUnauthorised(error: unknown): boolean {
  return error instanceof ApiRequestError && error.statusCode === 401;
}

function SelectField<T extends string>({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: T;
  values: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="field-label">
      {label}
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value as T)}>
        {values.map((item) => (
          <option value={item} key={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}

function Alert({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{message}</span>
      <button className="icon-only shrink-0" type="button" title="Dismiss" onClick={onDismiss}>
        <X size={16} />
      </button>
    </div>
  );
}
