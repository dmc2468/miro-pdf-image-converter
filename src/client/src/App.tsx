import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Download,
  FileArchive,
  FileText,
  Image,
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
import { createJob, createMagicLink, createUser, downloadJobZip, listJobs, listUsers, login, loginWithMagicLink, updateUser } from "./api";

const SESSION_KEY = "studio-mcleod-session";

type Module = "miro-converter" | "admin-users";

function currentModule(): Module {
  if (window.location.pathname.startsWith("/admin/users")) return "admin-users";
  return "miro-converter";
}

export function App() {
  const [session, setSession] = useState<UserSession | null>(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? (JSON.parse(stored) as UserSession) : null;
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
            onNavigate={navigateTo}
            onLogout={logout}
          />
          <main className="flex-1 overflow-auto">
            {activeModule === "admin-users" && session.user.role === "admin" ? (
              <AdminUsersPanel token={session.token} />
            ) : (
              <MiroConverterModule session={session} />
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
  onNavigate,
  onLogout,
}: {
  activeModule: Module;
  role: UserRole;
  email: string;
  onNavigate: (module: Module) => void;
  onLogout: () => void;
}) {
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
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="primary-button flex-1" type="button" disabled={busy || password.length < 10} onClick={() => void submit(true)}>
              Set password and sign in
            </button>
            <button className="secondary-button flex-1" type="button" disabled={busy} onClick={() => void submit(false)}>
              Sign in once
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiroConverterModule({ session }: { session: UserSession }) {
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
        <JobsPanel jobs={jobs} loading={jobsLoading} token={session.token} onRefresh={() => void refreshJobs()} onError={setMessage} />
      </section>
    </div>
  );
}

function AdminUsersPanel({ token }: { token: string }) {
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
      setMessage(error instanceof Error ? error.message : "Could not create magic link.");
    }
  }

  async function changeRole(user: AdminUser, nextRole: UserRole) {
    const result = await updateUser(token, user.id, { role: nextRole });
    setUsers((current) => current.map((item) => (item.id === user.id ? result.user : item)));
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
              <div className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_170px_180px]" key={user.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{user.email}</p>
                  <p className="mt-1 truncate text-xs text-muted">{user.name || "No name"} · created {new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
                <SelectField label="Role" value={user.role} values={["user", "admin"] as const} onChange={(nextRole) => void changeRole(user, nextRole)} />
                <button className="secondary-button self-end" type="button" onClick={() => void generateLink(user.id)}>
                  <Link size={16} />
                  Magic link
                </button>
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

function JobsPanel({
  jobs,
  loading,
  token,
  onRefresh,
  onError,
}: {
  jobs: ConversionJob[];
  loading: boolean;
  token: string;
  onRefresh: () => void;
  onError: (message: string) => void;
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
          jobs.map((job) => <JobRow job={job} token={token} onError={onError} key={job._id} />)
        )}
      </div>
    </aside>
  );
}

function JobRow({ job, token, onError }: { job: ConversionJob; token: string; onError: (message: string) => void }) {
  return (
    <div className="border-b border-line px-5 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {job.paperSize} &middot; {job.orientation} &middot; {job.drawingScale}
          </p>
          <p className="mt-1 text-xs text-muted">{new Date(job.createdAt).toLocaleString()}</p>
        </div>
        <span className={`status status-${job.status}`}>{job.status}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span>{job.generatedImages.length} JPEGs</span>
        <span>{job.targetPixelWidth}px</span>
      </div>
      {job.errorMessage ? <p className="mt-3 text-sm text-red-700">{job.errorMessage}</p> : null}
      {job.status === "completed" && job.zipFile ? (
        <button
          className="secondary-button mt-3 inline-flex"
          type="button"
          onClick={() => {
            void downloadJobZip(token, job._id).catch((error: unknown) => {
              onError(error instanceof Error ? error.message : "Download failed.");
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
