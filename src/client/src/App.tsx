import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  GitCommit,
  History,
  Image,
  KeyRound,
  Link,
  LogOut,
  Menu,
  Mic,
  MonitorUp,
  Play,
  RefreshCw,
  Save,
  Search,
  Shield,
  Square,
  Trash2,
  UploadCloud,
  Users,
  Video,
  X,
} from "lucide-react";
import { DRAWING_SCALES, ORIENTATIONS, PAPER_SIZES, getTargetPixelWidth } from "../../shared/scaling";
import type { AdminUser, ConversionJob, DrawingScale, MeetingRoom, MeetingRoomId, Orientation, PaperSize, UserRole, UserSession, VoiceCommand, VoiceCommandActionType, VoiceCommandInput, VoiceCommandModifier, VoiceCommandTargetApp } from "../../shared/types";
import { ApiRequestError, changePassword, clearMeetingRoomBoard, createJob, createMagicLink, createUser, createVoiceCommand, deleteJob, deleteUser, deleteVoiceCommand, downloadJobOutput, fetchReleaseNotes, fetchSessions, fetchVersion, importVoiceCommands, jobImageObjectUrl, joinMeetingRoom, leaveMeetingRoom, listJobs, listMeetingRooms, listUsers, listVoiceCommands, login, loginWithMagicLink, runVoiceCommand, shareMeetingRoomBoard, updateMeetingRoom, updateUser, updateVoiceCommand } from "./api";

const SESSION_KEY = "studio-mcleod-session";

type Module = "miro-converter" | "miro-board-share" | "meeting-rooms" | "voice-commands" | "admin-users" | "release-notes" | "sessions";

function currentModule(): Module {
  if (window.location.pathname.startsWith("/miro-board-share-tool")) return "miro-board-share";
  if (window.location.pathname.startsWith("/meeting-rooms")) return "meeting-rooms";
  if (window.location.pathname.startsWith("/voice-commands")) return "voice-commands";
  if (window.location.pathname.startsWith("/admin/users")) return "admin-users";
  if (window.location.pathname.startsWith("/admin/release-notes")) return "release-notes";
  if (window.location.pathname.startsWith("/admin/sessions")) return "sessions";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const onPopState = () => setActiveModule(currentModule());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigateTo(module: Module) {
    const paths: Record<Module, string> = {
      "miro-converter": "/miro-converter",
      "miro-board-share": "/miro-board-share-tool",
      "meeting-rooms": "/meeting-rooms",
      "voice-commands": "/voice-commands",
      "admin-users": "/admin/users",
      "release-notes": "/admin/release-notes",
      "sessions": "/admin/sessions",
    };
    window.history.pushState(null, "", paths[module]);
    setActiveModule(module);
    setMobileNavOpen(false);
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

  if (window.location.pathname === "/miro-board-share") {
    return <MiroBoardShareLauncher />;
  }

  if (window.location.pathname.startsWith("/miro-board-share-panel")) {
    return session ? (
      <MiroBoardSharePage session={session} onSessionExpired={expireSession} />
    ) : (
      <MiroBoardShareAuth onSession={storeSession} />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink lg:flex-row">
      {session ? (
        <>
          <MobileTopBar title={moduleTitles[activeModule]} onOpenNav={() => setMobileNavOpen(true)} />
          {mobileNavOpen ? (
            <div
              className="fixed inset-0 z-30 bg-black/40 lg:hidden"
              aria-hidden="true"
              onClick={() => setMobileNavOpen(false)}
            />
          ) : null}
          <Sidebar
            activeModule={activeModule}
            role={session.user.role}
            email={session.user.email}
            token={session.token}
            open={mobileNavOpen}
            onNavigate={navigateTo}
            onCloseNav={() => setMobileNavOpen(false)}
            onLogout={logout}
          />
          <main className="min-w-0 flex-1 overflow-auto">
            {activeModule === "release-notes" ? (
              <ReleaseNotesPanel />
            ) : activeModule === "sessions" ? (
              <SessionsPanel />
            ) : activeModule === "admin-users" && session.user.role === "admin" ? (
              <AdminUsersPanel token={session.token} currentUserId={session.user.id} onSessionExpired={expireSession} />
            ) : activeModule === "miro-board-share" ? (
              <MiroBoardSharePage session={session} onSessionExpired={expireSession} embedded />
            ) : activeModule === "meeting-rooms" ? (
              <MeetingRoomsModule session={session} onSessionExpired={expireSession} />
            ) : activeModule === "voice-commands" ? (
              <VoiceCommandsModule session={session} onSessionExpired={expireSession} />
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

function MobileTopBar({ title, onOpenNav }: { title: string; onOpenNav: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
      <button
        type="button"
        title="Open menu"
        aria-label="Open menu"
        className="icon-only h-10 w-10 shrink-0"
        onClick={onOpenNav}
      >
        <Menu size={20} />
      </button>
      <img src="/logo.jpg" alt="Studio McLeod" className="h-7 w-auto shrink-0" />
      <p className="truncate text-sm font-semibold text-ink">{title}</p>
    </header>
  );
}

type ModuleItem = {
  id: Module;
  label: string;
  icon: typeof Image;
};

const modules: ModuleItem[] = [
  { id: "miro-converter", label: "Miro converter", icon: Image },
  { id: "miro-board-share", label: "Miro board share", icon: MonitorUp },
  { id: "meeting-rooms", label: "Meeting rooms", icon: Video },
  { id: "voice-commands", label: "Vectorworks voice commands", icon: Mic },
];

const moduleTitles: Record<Module, string> = {
  "miro-converter": "Miro converter",
  "miro-board-share": "Miro board share",
  "meeting-rooms": "Meeting rooms",
  "voice-commands": "Vectorworks voice commands",
  "admin-users": "User management",
  "release-notes": "Release notes",
  "sessions": "Sessions",
};

function Sidebar({
  activeModule,
  role,
  email,
  token,
  open,
  onNavigate,
  onCloseNav,
  onLogout,
}: {
  activeModule: Module;
  role: UserRole;
  email: string;
  token: string;
  open: boolean;
  onNavigate: (module: Module) => void;
  onCloseNav: () => void;
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
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col overflow-y-auto border-r border-line bg-white transition-transform duration-200 lg:static lg:z-auto lg:max-w-none lg:translate-x-0 ${
        open ? "translate-x-0 shadow-xl" : "-translate-x-full"
      } lg:shadow-none`}
    >
      <div className="flex items-center gap-3 border-b border-line px-5 py-5">
        <img src="/logo.jpg" alt="Studio McLeod" className="h-8 w-auto" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Studio McLeod</p>
          <p className="truncate text-xs text-muted">Private tools</p>
        </div>
        <button
          type="button"
          title="Close menu"
          aria-label="Close menu"
          className="icon-only ml-auto shrink-0 lg:hidden"
          onClick={onCloseNav}
        >
          <X size={18} />
        </button>
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
            <button
              type="button"
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                activeModule === "release-notes"
                  ? "bg-ink text-white"
                  : "text-muted hover:bg-stone-100 hover:text-ink"
              }`}
              onClick={() => onNavigate("release-notes")}
            >
              <GitCommit size={18} />
              Release notes
            </button>
            <button
              type="button"
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                activeModule === "sessions"
                  ? "bg-ink text-white"
                  : "text-muted hover:bg-stone-100 hover:text-ink"
              }`}
              onClick={() => onNavigate("sessions")}
            >
              <History size={18} />
              Sessions
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
      await downloadJobOutput(session.token, result.job._id);
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
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

function MeetingRoomsModule({ session, onSessionExpired }: { session: UserSession; onSessionExpired: () => void }) {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [miroDrafts, setMiroDrafts] = useState<Partial<Record<MeetingRoomId, string>>>({});
  const [meetDrafts, setMeetDrafts] = useState<Partial<Record<MeetingRoomId, string>>>({});
  const [busyRoomId, setBusyRoomId] = useState<MeetingRoomId | null>(null);
  const isAdmin = session.user.role === "admin";

  useEffect(() => {
    void refreshRooms();
    const interval = window.setInterval(() => void refreshRooms(false), 12_000);
    return () => window.clearInterval(interval);
  }, []);

  async function refreshRooms(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const result = await listMeetingRooms(session.token);
      setRooms(result.rooms);
      setMeetDrafts((current) => {
        const next = { ...current };
        result.rooms.forEach((room) => {
          if (next[room.id] === undefined) next[room.id] = room.meetUrl;
        });
        return next;
      });
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not load meeting rooms.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  function replaceRoom(room: MeetingRoom) {
    setRooms((current) => current.map((item) => (item.id === room.id ? room : item)));
  }

  async function joinRoom(room: MeetingRoom) {
    setBusyRoomId(room.id);
    setMessage(null);
    const meetWindow = room.meetUrl ? window.open(room.meetUrl, "_blank", "noopener,noreferrer") : null;
    try {
      const result = await joinMeetingRoom(session.token, room.id);
      replaceRoom(result.room);
      if (!room.meetUrl) setMessage("This room does not have a Meet link yet.");
      if (room.meetUrl && !meetWindow) setMessage("Your browser blocked the Meet popup. Open it with the Meet button.");
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not join meeting room.");
    } finally {
      setBusyRoomId(null);
    }
  }

  async function leaveRoom(room: MeetingRoom) {
    setBusyRoomId(room.id);
    setMessage(null);
    try {
      const result = await leaveMeetingRoom(session.token, room.id);
      replaceRoom(result.room);
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not leave meeting room.");
    } finally {
      setBusyRoomId(null);
    }
  }

  async function saveMeetUrl(room: MeetingRoom) {
    setBusyRoomId(room.id);
    setMessage(null);
    try {
      const result = await updateMeetingRoom(session.token, room.id, { meetUrl: meetDrafts[room.id] ?? "" });
      replaceRoom(result.room);
      setMessage("Meet link saved.");
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not save Meet link.");
    } finally {
      setBusyRoomId(null);
    }
  }

  async function shareBoard(room: MeetingRoom) {
    const url = miroDrafts[room.id]?.trim();
    if (!url) {
      setMessage("Paste a Miro board URL first.");
      return;
    }
    setBusyRoomId(room.id);
    setMessage(null);
    try {
      const result = await shareMeetingRoomBoard(session.token, room.id, { url });
      replaceRoom(result.room);
      setMiroDrafts((current) => ({ ...current, [room.id]: "" }));
      setMessage("Miro board shared with the room.");
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not share Miro board.");
    } finally {
      setBusyRoomId(null);
    }
  }

  async function clearBoard(room: MeetingRoom) {
    setBusyRoomId(room.id);
    setMessage(null);
    try {
      const result = await clearMeetingRoomBoard(session.token, room.id);
      replaceRoom(result.room);
      setMessage("Miro board cleared.");
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not clear Miro board.");
    } finally {
      setBusyRoomId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Meeting rooms</h2>
          <p className="text-sm text-muted">Join TeamSpeak hangouts, launch Meet, and share the active Miro board for the room.</p>
        </div>
        <button className="icon-only" type="button" title="Refresh rooms" onClick={() => void refreshRooms()}>
          <RefreshCw size={17} />
        </button>
      </div>

      {message ? <div className="mb-5"><Alert message={message} onDismiss={() => setMessage(null)} /></div> : null}

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-20 text-sm text-muted">
          <RefreshCw className="animate-spin" size={16} />
          Loading...
        </p>
      ) : (
        <section className="grid gap-5 xl:grid-cols-3">
          {rooms.map((room) => (
            <MeetingRoomCard
              busy={busyRoomId === room.id}
              isAdmin={isAdmin}
              meetDraft={meetDrafts[room.id] ?? ""}
              miroDraft={miroDrafts[room.id] ?? ""}
              room={room}
              session={session}
              key={room.id}
              onClearBoard={() => void clearBoard(room)}
              onJoin={() => void joinRoom(room)}
              onLeave={() => void leaveRoom(room)}
              onMeetDraft={(value) => setMeetDrafts((current) => ({ ...current, [room.id]: value }))}
              onMiroDraft={(value) => setMiroDrafts((current) => ({ ...current, [room.id]: value }))}
              onSaveMeetUrl={() => void saveMeetUrl(room)}
              onShareBoard={() => void shareBoard(room)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function MeetingRoomCard({
  busy,
  isAdmin,
  meetDraft,
  miroDraft,
  room,
  session,
  onClearBoard,
  onJoin,
  onLeave,
  onMeetDraft,
  onMiroDraft,
  onSaveMeetUrl,
  onShareBoard,
}: {
  busy: boolean;
  isAdmin: boolean;
  meetDraft: string;
  miroDraft: string;
  room: MeetingRoom;
  session: UserSession;
  onClearBoard: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onMeetDraft: (value: string) => void;
  onMiroDraft: (value: string) => void;
  onSaveMeetUrl: () => void;
  onShareBoard: () => void;
}) {
  const joined = room.participants.some((participant) => participant.userId === session.user.id);

  return (
    <article className="rounded-xl border border-line bg-white">
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink">{room.name}</h3>
            <p className="mt-1 text-xs text-muted">{room.teamspeakChannelName}</p>
          </div>
          <span className="status status-processing">{room.participants.length}</span>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap gap-2">
          <button className="primary-button" type="button" disabled={busy} onClick={onJoin}>
            {busy ? <RefreshCw className="animate-spin" size={18} /> : <Video size={18} />}
            Join
          </button>
          {room.meetUrl ? (
            <a className="secondary-button" href={room.meetUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} />
              Meet
            </a>
          ) : null}
          {joined ? (
            <button className="secondary-button" type="button" disabled={busy} onClick={onLeave}>
              Leave
            </button>
          ) : null}
        </div>

        {isAdmin ? (
          <div className="rounded-lg border border-line bg-stone-50 p-3">
            <label className="field-label">
              Meet link
              <input className="field-input" value={meetDraft} onChange={(event) => onMeetDraft(event.target.value)} />
            </label>
            <button className="secondary-button mt-3" type="button" disabled={busy} onClick={onSaveMeetUrl}>
              <Save size={16} />
              Save Meet
            </button>
          </div>
        ) : null}

        <div>
          <div className="mb-2 flex items-center gap-2">
            <MonitorUp className="text-blue" size={18} />
            <h4 className="text-sm font-semibold text-ink">Miro board</h4>
          </div>
          {room.miroBoard ? (
            <div className="rounded-lg border border-blue/20 bg-blue/5 p-3">
              <p className="break-all text-sm font-medium text-ink">{room.miroBoard.url}</p>
              <p className="mt-2 text-xs text-muted">
                Shared by {room.miroBoard.sharedByName ?? room.miroBoard.sharedByEmail} · {new Date(room.miroBoard.sharedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a className="secondary-button" href={room.miroBoard.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={16} />
                  Open Miro
                </a>
                <button className="secondary-button" type="button" onClick={() => void navigator.clipboard.writeText(room.miroBoard?.url ?? "")}>
                  <Copy size={16} />
                  Copy
                </button>
                <button className="secondary-button" type="button" disabled={busy} onClick={onClearBoard}>
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-line bg-stone-50 px-3 py-4 text-sm text-muted">No board shared yet.</p>
          )}
        </div>

        <div className="flex gap-2">
          <input className="field-input mt-0" value={miroDraft} placeholder="https://miro.com/app/board/..." onChange={(event) => onMiroDraft(event.target.value)} />
          <button className="secondary-button h-11 shrink-0" type="button" disabled={busy || !miroDraft.trim()} onClick={onShareBoard}>
            Share
          </button>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">In room</p>
          {room.participants.length ? (
            <div className="space-y-2">
              {room.participants.map((participant) => (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2 text-sm" key={participant.userId}>
                  <span className="truncate font-medium text-ink">{participant.name ?? participant.email}</span>
                  <span className="shrink-0 text-xs text-muted">{new Date(participant.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Empty</p>
          )}
        </div>
      </div>
    </article>
  );
}

interface MiroBoardInfo {
  id: string;
  name?: string;
  title?: string;
}

interface MiroBoardApi {
  getInfo(): Promise<MiroBoardInfo>;
  ui?: MiroBoardUi;
}

interface MiroBoardUi {
  on(eventName: "icon:click", handler: () => void | Promise<void>): void | Promise<void>;
  openPanel(options: MiroPanelOptions): Promise<void>;
}

interface MiroPanelOptions {
  url: string;
}

interface MiroApi {
  board: MiroBoardApi;
}

interface MiroWindow extends Window {
  miro?: MiroApi;
}

function MiroBoardShareLauncher() {
  const [message, setMessage] = useState("Preparing SM Board Share...");

  useEffect(() => {
    void initialiseMiroLauncher();
  }, []);

  async function initialiseMiroLauncher() {
    try {
      await promiseWithTimeout(loadMiroSdk(), 10000, "Miro did not finish loading the app SDK. Reload the board and try again.");
      const miro = (window as MiroWindow).miro;
      if (!miro?.board?.ui?.on || !miro.board.ui.openPanel) {
        throw new Error("Miro did not provide the board app launcher. Reload the board after installing the app.");
      }
      const panelUrl = new URL("/miro-board-share-panel", window.location.origin).toString();
      await Promise.resolve(miro.board.ui.on("icon:click", async () => {
        await miro.board.ui?.openPanel({ url: panelUrl });
      }));
      setMessage("SM Board Share is ready. Open it from the Miro app icon.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not prepare SM Board Share.");
    }
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-5 text-ink">
      <div className="mx-auto max-w-[380px]">
        <img src="/logo.jpg" alt="Studio McLeod" className="mb-5 h-8 w-auto" />
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <h1 className="text-base font-semibold">SM Board Share</h1>
          <p className="mt-2 text-sm text-muted">{message}</p>
        </div>
      </div>
    </main>
  );
}

function MiroBoardShareAuth({ onSession }: { onSession: (session: UserSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onSession(await login(email, password));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-5 text-ink">
      <div className="mx-auto max-w-[380px]">
        <img src="/logo.jpg" alt="Studio McLeod" className="mb-5 h-8 w-auto" />
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <h1 className="text-base font-semibold">Share Miro board</h1>
          <p className="mt-1 text-sm text-muted">Sign in to share this board with a Studio meeting room.</p>
          <div className="mt-5 space-y-4">
            <label className="field-label">
              Email
              <input className="field-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="field-label">
              Password
              <input className="field-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {error ? <Alert message={error} onDismiss={() => setError(null)} /> : null}
            <button className="primary-button w-full" type="button" disabled={busy || !email || !password} onClick={() => void submit()}>
              {busy ? <RefreshCw className="animate-spin" size={18} /> : null}
              Sign in
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function MiroBoardSharePage({ session, onSessionExpired, embedded = false }: { session: UserSession; onSessionExpired: () => void; embedded?: boolean }) {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<MeetingRoomId>("call-hangout-1");
  const [boardInfo, setBoardInfo] = useState<MiroBoardInfo | null>(null);
  const [manualBoardUrl, setManualBoardUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void initialiseMiroShare();
  }, []);

  async function initialiseMiroShare() {
    setLoading(true);
    setMessage(null);
    try {
      const roomsResult = await listMeetingRooms(session.token);
      setRooms(roomsResult.rooms);
      setSelectedRoomId(roomsResult.rooms[0]?.id ?? "call-hangout-1");
      try {
        setBoardInfo(await currentMiroBoardInfo());
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Miro did not provide the current board.");
      }
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not prepare Miro board sharing.");
    } finally {
      setLoading(false);
    }
  }

  async function shareCurrentBoard() {
    const boardUrl = boardInfo ? miroBoardUrl(boardInfo.id) : manualBoardUrl.trim();
    if (!boardUrl) {
      setMessage("Use the detected board or paste a Miro board URL first.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await shareMeetingRoomBoard(session.token, selectedRoomId, { url: boardUrl });
      const roomName = rooms.find((room) => room.id === selectedRoomId)?.name ?? "the selected room";
      setMessage(`Shared with ${roomName}.`);
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not share the Miro board.");
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <div className={embedded ? "mx-auto w-full max-w-xl px-6 py-6" : "mx-auto max-w-[420px]"}>
      <div className="mb-5 flex items-center gap-3">
        {!embedded ? <img src="/logo.jpg" alt="Studio McLeod" className="h-8 w-auto" /> : null}
        <div>
          <h1 className={embedded ? "text-lg font-semibold" : "text-base font-semibold"}>Share Miro board</h1>
          <p className="text-xs text-muted">{session.user.email}</p>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
            <RefreshCw className="animate-spin" size={16} />
            Loading...
          </p>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border border-line bg-stone-50 p-3">
              <p className="text-xs font-semibold uppercase text-muted">Current board</p>
              <p className="mt-1 break-words text-sm font-semibold text-ink">{boardInfo ? boardTitle(boardInfo) : "Unavailable"}</p>
              {boardInfo ? <p className="mt-1 break-all text-xs text-muted">{miroBoardUrl(boardInfo.id)}</p> : null}
            </div>

            {!boardInfo ? (
              <label className="field-label">
                Miro board URL
                <input className="field-input" value={manualBoardUrl} placeholder="https://miro.com/app/board/..." onChange={(event) => setManualBoardUrl(event.target.value)} />
              </label>
            ) : null}

            <SelectField label="Meeting room" value={selectedRoomId} values={meetingRoomIds(rooms)} onChange={setSelectedRoomId} />

            <button className="primary-button w-full" type="button" disabled={busy || (!boardInfo && !manualBoardUrl.trim()) || rooms.length === 0} onClick={() => void shareCurrentBoard()}>
              {busy ? <RefreshCw className="animate-spin" size={18} /> : <MonitorUp size={18} />}
              Share to room
            </button>

            {message ? <Alert message={message} onDismiss={() => setMessage(null)} /> : null}
          </div>
        )}
      </section>
    </div>
  );

  if (embedded) return content;

  return (
    <main className="min-h-screen bg-paper px-4 py-5 text-ink">
      {content}
    </main>
  );
}

async function currentMiroBoardInfo(): Promise<MiroBoardInfo> {
  await promiseWithTimeout(loadMiroSdk(), 5000, "Miro did not finish loading the board SDK. Paste the board URL below for this test.");
  const miro = (window as MiroWindow).miro;
  if (!miro?.board?.getInfo) {
    throw new Error("Miro did not provide the current board. Paste the board URL below for this test.");
  }
  const info = await promiseWithTimeout(miro.board.getInfo(), 5000, "Miro did not return the current board quickly enough. Paste the board URL below for this test.");
  if (!info.id) {
    throw new Error("Miro did not return a board ID.");
  }
  return info;
}

function loadMiroSdk(): Promise<void> {
  if ((window as MiroWindow).miro) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>("script[data-miro-sdk]");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load the Miro SDK.")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://miro.com/app/static/sdk/v2/miro.js";
    script.async = true;
    script.dataset.miroSdk = "true";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Could not load the Miro SDK.")), { once: true });
    document.head.append(script);
  });
}

function promiseWithTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      });
  });
}

function miroBoardUrl(boardId: string): string {
  return `https://miro.com/app/board/${boardId}/`;
}

function boardTitle(board: MiroBoardInfo): string {
  return board.name ?? board.title ?? board.id;
}

function meetingRoomIds(rooms: MeetingRoom[]): MeetingRoomId[] {
  const ids = rooms.map((room) => room.id);
  return ids.length ? ids : ["call-hangout-1", "call-hangout-2", "call-hangout-3"];
}

const voiceCommandTargetApps: VoiceCommandTargetApp[] = ["Vectorworks", "Vectorworks 2026", "Vectorworks 2025", "Miro", "Chrome", "Finder", "Other"];
const voiceCommandActionTypes: VoiceCommandActionType[] = ["shortcut", "macro", "script"];
const voiceCommandModifiers: VoiceCommandModifier[] = ["command", "shift", "option", "control"];

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructorLike {
  new(): SpeechRecognitionLike;
}

interface VoiceWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
}

interface VoiceCommandDraft {
  id: string;
  enabled: boolean;
  voicePhrase: string;
  targetApp: VoiceCommandTargetApp;
  actionType: VoiceCommandActionType;
  key: string;
  modifiers: VoiceCommandModifier[];
  macroName: string;
  notes: string;
}

function VoiceCommandsModule({ session, onSessionExpired }: { session: UserSession; onSessionExpired: () => void }) {
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<VoiceCommandDraft>(blankVoiceCommandDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [heardPhrase, setHeardPhrase] = useState("");
  const [matchedCommand, setMatchedCommand] = useState<VoiceCommand | null>(null);
  const [listening, setListening] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [lastAppleScript, setLastAppleScript] = useState("");
  const isAdmin = session.user.role === "admin";

  useEffect(() => {
    void refreshCommands();
  }, []);

  async function refreshCommands() {
    setLoading(true);
    try {
      const result = await listVoiceCommands(session.token);
      setCommands(result.commands);
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not load Vectorworks voice commands.");
    } finally {
      setLoading(false);
    }
  }

  async function saveCommand() {
    setBusy(true);
    setMessage(null);
    try {
      const input = draftToVoiceCommandInput(draft);
      const result = editingId
        ? await updateVoiceCommand(session.token, editingId, input)
        : await createVoiceCommand(session.token, input);
      setCommands((current) => {
        const withoutExisting = current.filter((command) => command.id !== (editingId ?? result.command.id));
        return [...withoutExisting, result.command].sort(sortVoiceCommands);
      });
      setEditingId(null);
      setDraft(blankVoiceCommandDraft());
      setMessage("Voice command saved.");
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not save voice command.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleCommand(command: VoiceCommand) {
    setMessage(null);
    try {
      const result = await updateVoiceCommand(session.token, command.id, { enabled: !command.enabled });
      setCommands((current) => current.map((item) => (item.id === command.id ? result.command : item)).sort(sortVoiceCommands));
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not update voice command.");
    }
  }

  async function removeCommand(commandId: string) {
    setMessage(null);
    try {
      await deleteVoiceCommand(session.token, commandId);
      setCommands((current) => current.filter((command) => command.id !== commandId));
      if (editingId === commandId) {
        setEditingId(null);
        setDraft(blankVoiceCommandDraft());
      }
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not delete voice command.");
    }
  }

  async function runCommand(command: VoiceCommand, testOnly: boolean) {
    setMessage(null);
    setLastAppleScript("");
    try {
      const result = await runVoiceCommand(session.token, command.id, testOnly);
      setLastAppleScript(result.appleScript);
      setMessage(result.message);
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not run voice command.");
    }
  }

  function editCommand(command: VoiceCommand) {
    setEditingId(command.id);
    setDraft({
      id: command.id,
      enabled: command.enabled,
      voicePhrase: command.voicePhrase,
      targetApp: command.targetApp,
      actionType: command.actionType,
      key: command.key,
      modifiers: command.modifiers,
      macroName: command.macroName,
      notes: command.notes,
    });
  }

  function matchPhrase(phrase: string) {
    const normalised = phrase.trim().toLowerCase();
    const match = commands.find((command) => command.enabled && command.voicePhrase.trim().toLowerCase() === normalised) ?? null;
    setHeardPhrase(normalised);
    setMatchedCommand(match);
    setMessage(match ? "Command matched. Review it before running." : "No enabled command matched that phrase.");
  }

  async function startSpeechRecognition() {
    const voiceWindow = window as VoiceWindow;
    const Recognition = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage("Speech recognition is not available in this browser.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("This browser cannot request microphone access. Type the phrase and press Match for now.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setMessage(microphoneAccessErrorMessage(error));
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.lang = "en-GB";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const result = event.results.item(0);
      const alternative = result.item(0);
      stopMediaStream(stream);
      matchPhrase(alternative.transcript);
    };
    recognition.onerror = (event) => {
      stopMediaStream(stream);
      setMessage(speechRecognitionErrorMessage(event.error));
      setListening(false);
    };
    recognition.onend = () => {
      stopMediaStream(stream);
      setListening(false);
    };
    setListening(true);
    setMessage("Microphone ready. Listening for one phrase.");
    window.setTimeout(() => recognition.start(), 250);
  }

  async function importJsonFile(file: File) {
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const commandsInput = Array.isArray(parsed) ? parsed : isCommandsEnvelope(parsed) ? parsed.commands : undefined;
      if (!commandsInput) {
        setMessage("JSON import must be a command array or an object with commands.");
        return;
      }
      const result = await importVoiceCommands(session.token, commandsInput.map(jsonToVoiceCommandInput));
      setCommands(result.commands);
      setMessage("Vectorworks voice commands imported.");
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not import JSON.");
    }
  }

  async function importCsvFile(file: File) {
    setMessage(null);
    try {
      const rows = parseCsv(await file.text());
      const result = await importVoiceCommands(session.token, rows.map(csvRowToVoiceCommandInput));
      setCommands(result.commands);
      setMessage("Vectorworks voice commands imported.");
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not import CSV.");
    }
  }

  function exportJson() {
    downloadText("vectorworks-voice-commands.json", JSON.stringify(commands.map(commandToExport), null, 2), "application/json");
  }

  function exportCsv() {
    const headers = ["id", "enabled", "voicePhrase", "targetApp", "actionType", "key", "modifiers", "macroName", "notes"];
    const rows = commands.map((command) => [
      command.id,
      String(command.enabled),
      command.voicePhrase,
      command.targetApp,
      command.actionType,
      command.key,
      command.modifiers.join("+"),
      command.macroName,
      command.notes,
    ]);
    downloadText("vectorworks-voice-commands.csv", [headers, ...rows].map(csvLine).join("\n"), "text/csv");
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Vectorworks Voice Commands</h2>
          <p className="text-sm text-muted">Maintain fixed, approved voice shortcuts for Vectorworks and other Studio McLeod tools.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button" type="button" onClick={exportJson}>
            <Download size={16} />
            JSON
          </button>
          <button className="secondary-button" type="button" onClick={exportCsv}>
            <Download size={16} />
            CSV
          </button>
          {isAdmin ? (
            <>
              <label className="secondary-button cursor-pointer">
                <UploadCloud size={16} />
                Import JSON
                <input className="hidden" type="file" accept="application/json" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importJsonFile(file);
                  event.currentTarget.value = "";
                }} />
              </label>
              <label className="secondary-button cursor-pointer">
                <UploadCloud size={16} />
                Import CSV
                <input className="hidden" type="file" accept=".csv,text/csv" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importCsvFile(file);
                  event.currentTarget.value = "";
                }} />
              </label>
            </>
          ) : null}
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="field-label min-w-[260px] flex-1">
            Heard phrase
            <input className="field-input" value={heardPhrase} onChange={(event) => setHeardPhrase(event.target.value)} onBlur={() => matchPhrase(heardPhrase)} />
          </label>
          <button className="primary-button" type="button" disabled={listening} onClick={() => void startSpeechRecognition()}>
            {listening ? <RefreshCw className="animate-spin" size={18} /> : <Mic size={18} />}
            {listening ? "Listening" : "Listen"}
          </button>
          <button className="secondary-button" type="button" onClick={() => matchPhrase(heardPhrase)}>
            <Search size={16} />
            Match
          </button>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink">
            <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} />
            Test mode
          </label>
        </div>
        {listening ? <p className="mt-3 text-xs text-muted">Listening for one phrase. You can also type the phrase and press Match.</p> : null}
        {matchedCommand ? (
          <div className="mt-4 rounded-lg border border-line bg-stone-50 p-4">
            <div className="grid gap-3 md:grid-cols-4">
              <InfoItem label="Matched command" value={matchedCommand.voicePhrase} />
              <InfoItem label="Target app" value={matchedCommand.targetApp} />
              <InfoItem label="Shortcut" value={shortcutLabel(matchedCommand)} />
              <InfoItem label="Action" value={matchedCommand.actionType} />
            </div>
            <button className="primary-button mt-4" type="button" onClick={() => void runCommand(matchedCommand, dryRun)}>
              {dryRun ? <Square size={16} /> : <Play size={16} />}
              {dryRun ? "Test command" : "Run command"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-6">
        <div className="rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <h2 className="font-semibold">Commands</h2>
            <button className="icon-only" type="button" title="Refresh commands" onClick={() => void refreshCommands()}>
              <RefreshCw size={17} />
            </button>
          </div>
          {message ? <div className="px-5 py-4"><Alert message={message} onDismiss={() => setMessage(null)} /></div> : null}
          <div className="overflow-auto">
            {loading ? (
              <p className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-muted">
                <RefreshCw className="animate-spin" size={16} />
                Loading...
              </p>
            ) : commands.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted">No Vectorworks voice commands yet.</p>
            ) : (
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-line bg-stone-50 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Phrase</th>
                    <th className="px-4 py-3 font-semibold">Target</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                    <th className="px-4 py-3 font-semibold">Shortcut</th>
                    <th className="px-4 py-3 font-semibold">Notes</th>
                    <th className="px-4 py-3 font-semibold">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {commands.map((command) => (
                    <tr key={command.id} className={command.enabled ? "bg-white" : "bg-stone-50 text-muted"}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{command.voicePhrase}</div>
                        <div className="text-xs text-muted">{command.id}</div>
                      </td>
                      <td className="px-4 py-3">{command.targetApp}</td>
                      <td className="px-4 py-3">{command.actionType}</td>
                      <td className="px-4 py-3 font-mono text-xs">{shortcutLabel(command)}</td>
                      <td className="max-w-[280px] px-4 py-3 text-xs text-muted">{command.notes}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button className="secondary-button h-9" type="button" onClick={() => void runCommand(command, true)}>
                            <Square size={15} />
                            Test
                          </button>
                          <button className="secondary-button h-9" type="button" disabled={!command.enabled} onClick={() => void runCommand(command, false)}>
                            <Play size={15} />
                            Run
                          </button>
                          {isAdmin ? (
                            <>
                              <button className="secondary-button h-9" type="button" onClick={() => editCommand(command)}>
                                <Save size={15} />
                                Edit
                              </button>
                              <button className="secondary-button h-9" type="button" onClick={() => void toggleCommand(command)}>
                                {command.enabled ? "Disable" : "Enable"}
                              </button>
                              <button className="icon-only h-9 w-9 text-red-600" type="button" title="Delete command" onClick={() => void removeCommand(command.id)}>
                                <Trash2 size={16} />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {isAdmin ? (
          <VoiceCommandEditor
            busy={busy}
            draft={draft}
            editingId={editingId}
            onCancel={() => {
              setEditingId(null);
              setDraft(blankVoiceCommandDraft());
            }}
            onDraft={setDraft}
            onSave={() => void saveCommand()}
          />
        ) : null}
      </section>

      {lastAppleScript ? (
        <section className="mt-6 rounded-xl border border-line bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold">Generated AppleScript</h2>
          <pre className="overflow-auto rounded-lg bg-stone-100 p-3 text-xs text-ink">{lastAppleScript}</pre>
        </section>
      ) : null}
    </div>
  );
}

function VoiceCommandEditor({
  busy,
  draft,
  editingId,
  onCancel,
  onDraft,
  onSave,
}: {
  busy: boolean;
  draft: VoiceCommandDraft;
  editingId: string | null;
  onCancel: () => void;
  onDraft: (draft: VoiceCommandDraft) => void;
  onSave: () => void;
}) {
  function update<K extends keyof VoiceCommandDraft>(key: K, value: VoiceCommandDraft[K]) {
    onDraft({ ...draft, [key]: value });
  }

  function toggleModifier(modifier: VoiceCommandModifier) {
    update(
      "modifiers",
      draft.modifiers.includes(modifier)
        ? draft.modifiers.filter((item) => item !== modifier)
        : [...draft.modifiers, modifier],
    );
  }

  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <div className="mb-4 flex items-center gap-3">
        <Mic className="text-blue" size={20} />
        <h2 className="text-base font-semibold">{editingId ? "Edit command" : "Add command"}</h2>
      </div>
      <div className="space-y-4">
        <label className="field-label">
          ID
          <input className="field-input" value={draft.id} onChange={(event) => update("id", event.target.value)} />
        </label>
        <label className="field-label">
          Voice phrase
          <input className="field-input" value={draft.voicePhrase} onChange={(event) => update("voicePhrase", event.target.value)} />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Target app" value={draft.targetApp} values={voiceCommandTargetApps} onChange={(value) => update("targetApp", value)} />
          <SelectField label="Action type" value={draft.actionType} values={voiceCommandActionTypes} onChange={(value) => update("actionType", value)} />
        </div>
        <label className="field-label">
          Key
          <input className="field-input" value={draft.key} onChange={(event) => update("key", event.target.value)} />
        </label>
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Modifiers</p>
          <div className="flex flex-wrap gap-2">
            {voiceCommandModifiers.map((modifier) => (
              <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink" key={modifier}>
                <input type="checkbox" checked={draft.modifiers.includes(modifier)} onChange={() => toggleModifier(modifier)} />
                {modifier}
              </label>
            ))}
          </div>
        </div>
        <label className="field-label">
          Macro name
          <input className="field-input" value={draft.macroName} onChange={(event) => update("macroName", event.target.value)} />
        </label>
        <label className="field-label">
          Notes
          <textarea className="mt-2 min-h-24 w-full rounded-lg border border-line bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10" value={draft.notes} onChange={(event) => update("notes", event.target.value)} />
        </label>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink">
          <input type="checkbox" checked={draft.enabled} onChange={(event) => update("enabled", event.target.checked)} />
          Enabled
        </label>
        <div className="flex gap-2">
          <button className="primary-button flex-1" type="button" disabled={busy || !draft.voicePhrase || (draft.actionType === "shortcut" && !draft.key)} onClick={onSave}>
            {busy ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
            Save
          </button>
          <button className="secondary-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-ink">{value}</p>
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
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingNameDraft, setEditingNameDraft] = useState("");

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

  async function updateName(userId: string) {
    setEditingName(null);
    try {
      const result = await updateUser(token, userId, { name: editingNameDraft || undefined });
      setUsers((current) => current.map((item) => (item.id === userId ? result.user : item)));
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
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
                  <div className="mt-1">
                    {editingName === user.id ? (
                      <input
                        className="h-7 w-full rounded border border-line bg-white px-2 text-xs text-ink outline-none"
                        type="text"
                        value={editingNameDraft}
                        onChange={(event) => setEditingNameDraft(event.target.value)}
                        onBlur={() => void updateName(user.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void updateName(user.id);
                          if (event.key === "Escape") setEditingName(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="cursor-pointer truncate text-xs text-muted hover:text-ink"
                        title="Click to edit name"
                        onClick={() => {
                          setEditingName(user.id);
                          setEditingNameDraft(user.name || "");
                        }}
                      >
                        {user.name || "No name"} · created {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
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

const REPO_URL = "https://github.com/dmc2468/miro-pdf-image-converter";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineCode(escapedText: string): string {
  return escapedText.replace(/`([^`]+)`/g, "<code>$1</code>");
}

function linkifyIssueRefs(escapedText: string): string {
  return escapedText.replace(
    /(^|[^\w/&])#(\d+)\b/g,
    `$1<a href="${REPO_URL}/issues/$2" target="_blank" rel="noopener">#$2</a>`,
  );
}

function renderCommitBody(body: string): string {
  if (!body.trim()) return "";
  const blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const isHeading = lines.length === 1 && /^#{1,3}\s/.test(lines[0]!);
      if (isHeading) {
        const level = lines[0]!.match(/^#{1,3}/)![0]!.length;
        const text = lines[0]!.replace(/^#{1,3}\s+/, "");
        return `<h${level}>${linkifyIssueRefs(renderInlineCode(escapeHtml(text)))}</h${level}>`;
      }
      const hasBullets = lines.some((l) => /^-\s/.test(l));
      if (hasBullets) {
        const items: string[] = [];
        let current: string | null = null;
        for (const line of lines) {
          if (/^-\s/.test(line)) {
            if (current !== null) items.push(current);
            current = line.replace(/^-\s+/, "");
          } else if (current !== null) {
            current += " " + line.trim();
          }
        }
        if (current !== null) items.push(current);
        const html = items
          .map((i) => `<li>${linkifyIssueRefs(renderInlineCode(escapeHtml(i)))}</li>`)
          .join("");
        return `<ul>${html}</ul>`;
      }
      const collapsed = block.replace(/\n/g, " ");
      return `<p>${linkifyIssueRefs(renderInlineCode(escapeHtml(collapsed)))}</p>`;
    })
    .join("");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ReleaseNotesPanel() {
  const [entries, setEntries] = useState<import("./api").ReleaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const result = await fetchReleaseNotes();
        setEntries(result.entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load release notes.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">Release notes</h2>
          <p className="mt-0.5 text-sm text-muted">
            <a href={REPO_URL} target="_blank" rel="noopener" className="inline-flex max-w-full items-center gap-1.5 text-muted hover:text-ink">
              <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" fill="currentColor" className="shrink-0">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
              <span className="truncate">{REPO_URL.replace("https://", "")}</span>
              <ExternalLink size={12} className="shrink-0" />
            </a>
          </p>
        </div>
        <button className="icon-only" type="button" title="Refresh" onClick={() => {
          setLoading(true);
          setError(null);
          void fetchReleaseNotes().then((result) => setEntries(result.entries)).catch((err) => setError(err instanceof Error ? err.message : "Could not load release notes.")).finally(() => setLoading(false));
        }}>
          <RefreshCw size={17} />
        </button>
      </div>

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-20 text-sm text-muted">
          <RefreshCw className="animate-spin" size={16} />
          Loading...
        </p>
      ) : error ? (
        <p className="py-20 text-center text-sm text-red-600">{error}</p>
      ) : entries.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted">No entries yet.</p>
      ) : (
        <ol className="space-y-4">
          {entries.map((entry) => (
            <li key={entry.sha} className="rounded-xl border border-line bg-white p-5">
              <div className="mb-2 flex items-center gap-3">
                <a
                  href={`${REPO_URL}/commit/${entry.sha}`}
                  target="_blank"
                  rel="noopener"
                  className="font-mono text-xs text-blue hover:underline"
                >
                  {entry.sha}
                </a>
                <span className="text-xs text-muted">{entry.author}</span>
                <span className="text-xs text-muted">{formatDate(entry.date)}</span>
              </div>
              <p
                className="text-sm font-semibold text-ink"
                dangerouslySetInnerHTML={{ __html: linkifyIssueRefs(renderInlineCode(escapeHtml(entry.subject))) }}
              />
              {entry.body ? (
                <div
                  className="release-body mt-2 text-sm text-muted"
                  dangerouslySetInnerHTML={{ __html: renderCommitBody(entry.body) }}
                />
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SessionsPanel() {
  const [sessions, setSessions] = useState<import("./api").SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    void fetchSessions()
      .then((result) => {
        setSessions(result.sessions);
        setExpandedId((current) => current ?? result.sessions[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load sessions."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">Sessions</h2>
          <p className="mt-0.5 text-sm text-muted">Notes from working sessions on this project.</p>
        </div>
        <button className="icon-only" type="button" title="Refresh" onClick={load}>
          <RefreshCw size={17} />
        </button>
      </div>

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-20 text-sm text-muted">
          <RefreshCw className="animate-spin" size={16} />
          Loading...
        </p>
      ) : error ? (
        <p className="py-20 text-center text-sm text-red-600">{error}</p>
      ) : sessions.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted">No sessions yet.</p>
      ) : (
        <ol className="space-y-4">
          {sessions.map((entry) => {
            const expanded = expandedId === entry.id;
            return (
              <li key={entry.id} className="rounded-xl border border-line bg-white p-5">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setExpandedId(expanded ? null : entry.id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{entry.title}</span>
                    {entry.date ? <span className="text-xs text-muted">{formatDate(entry.date)}</span> : null}
                  </span>
                  <ChevronDown
                    className={`shrink-0 text-muted transition ${expanded ? "rotate-180" : ""}`}
                    size={18}
                  />
                </button>
                {expanded ? (
                  <div
                    className="session-body mt-3 max-w-full overflow-x-hidden border-t border-line pt-3 text-sm text-muted"
                    dangerouslySetInnerHTML={{ __html: entry.trustedBodyHtml }}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
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
      {job.status === "completed" && job.generatedImages.length ? (
        <button
          className="secondary-button mt-3 inline-flex"
          type="button"
          onClick={() => {
            void downloadJobOutput(token, job._id).catch((error: unknown) => {
              onError(error instanceof Error ? error.message : "Download failed.");
              if (isUnauthorised(error)) onSessionExpired();
            });
          }}
        >
          <Download size={16} />
          Download {job.generatedImages.length === 1 ? "JPEG" : "ZIP"}
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

function blankVoiceCommandDraft(): VoiceCommandDraft {
  return {
    id: "",
    enabled: true,
    voicePhrase: "",
    targetApp: "Vectorworks",
    actionType: "shortcut",
    key: "",
    modifiers: [],
    macroName: "",
    notes: "",
  };
}

function draftToVoiceCommandInput(draft: VoiceCommandDraft): VoiceCommandInput {
  return {
    id: draft.id || undefined,
    enabled: draft.enabled,
    voicePhrase: draft.voicePhrase,
    targetApp: draft.targetApp,
    actionType: draft.actionType,
    key: draft.key,
    modifiers: draft.modifiers,
    macroName: draft.macroName,
    notes: draft.notes,
  };
}

function sortVoiceCommands(left: VoiceCommand, right: VoiceCommand): number {
  return left.voicePhrase.localeCompare(right.voicePhrase);
}

function shortcutLabel(command: VoiceCommand): string {
  if (command.actionType !== "shortcut") return command.macroName || command.actionType;
  return [...command.modifiers, command.key].filter(Boolean).join("+") || "No shortcut";
}

function commandToExport(command: VoiceCommand): VoiceCommandInput {
  return {
    id: command.id,
    enabled: command.enabled,
    voicePhrase: command.voicePhrase,
    targetApp: command.targetApp,
    actionType: command.actionType,
    key: command.key,
    modifiers: command.modifiers,
    macroName: command.macroName,
    notes: command.notes,
  };
}

function speechRecognitionErrorMessage(error: string): string {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Microphone access was blocked. Allow microphone access for this browser, then try Listen again.";
  }
  if (error === "audio-capture") {
    return "No microphone was available to the browser.";
  }
  if (error === "no-speech") {
    return "No speech was heard. Try again, or type the phrase and press Match.";
  }
  if (error === "network") {
    return "Speech recognition could not reach the browser speech service. Type the phrase and press Match for now.";
  }
  if (error === "aborted") {
    return "Speech recognition was stopped before a phrase was heard.";
  }
  return `Speech recognition failed: ${error}. Type the phrase and press Match for now.`;
}

function microphoneAccessErrorMessage(error: unknown): string {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
    return "Microphone access was blocked. Allow microphone access for this site in Chrome, then try Listen again.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "Chrome could not find a microphone. Check the selected input device in Chrome or macOS settings.";
  }
  if (error instanceof DOMException && error.name === "NotReadableError") {
    return "Chrome could not read from the microphone. Another app may be using it, or macOS may be blocking access.";
  }
  return "Chrome could not start the microphone. Type the phrase and press Match for now.";
}

function stopMediaStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

interface CommandsEnvelope {
  commands: unknown[];
}

function isCommandsEnvelope(value: unknown): value is CommandsEnvelope {
  return typeof value === "object" && value !== null && "commands" in value && Array.isArray(value.commands);
}

function jsonToVoiceCommandInput(value: unknown): VoiceCommandInput {
  if (!isObjectRecord(value)) {
    throw new Error("Each imported command must be an object.");
  }
  return {
    id: optionalText(value.id),
    enabled: value.enabled === undefined ? true : value.enabled === true || value.enabled === "true",
    voicePhrase: requiredText(value.voicePhrase, "Voice phrase is required."),
    targetApp: targetAppValue(requiredText(value.targetApp, "Target app is required.")),
    actionType: actionTypeValue(requiredText(value.actionType, "Action type is required.")),
    key: optionalText(value.key) ?? "",
    modifiers: modifiersValue(value.modifiers),
    macroName: optionalText(value.macroName) ?? "",
    notes: optionalText(value.notes) ?? "",
  };
}

function csvRowToVoiceCommandInput(row: Record<string, string>): VoiceCommandInput {
  return {
    id: row.id || undefined,
    enabled: row.enabled !== "false",
    voicePhrase: row.voicePhrase,
    targetApp: targetAppValue(row.targetApp),
    actionType: actionTypeValue(row.actionType),
    key: row.key ?? "",
    modifiers: row.modifiers ? row.modifiers.split("+").filter(Boolean).map(modifierValue) : [],
    macroName: row.macroName ?? "",
    notes: row.notes ?? "",
  };
}

function targetAppValue(value: string): VoiceCommandTargetApp {
  if (voiceCommandTargetApps.includes(value as VoiceCommandTargetApp)) return value as VoiceCommandTargetApp;
  throw new Error("Target app is not supported.");
}

function actionTypeValue(value: string): VoiceCommandActionType {
  if (voiceCommandActionTypes.includes(value as VoiceCommandActionType)) return value as VoiceCommandActionType;
  throw new Error("Action type is not supported.");
}

function modifiersValue(value: unknown): VoiceCommandModifier[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value.map((item) => modifierValue(requiredText(item, "Modifier must be text.")));
  if (typeof value === "string") return value.split("+").filter(Boolean).map(modifierValue);
  throw new Error("Modifiers must be a list.");
}

function modifierValue(value: string): VoiceCommandModifier {
  if (voiceCommandModifiers.includes(value as VoiceCommandModifier)) return value as VoiceCommandModifier;
  throw new Error("Modifier is not supported.");
}

function parseCsv(text: string): Record<string, string>[] {
  const rows = csvRows(text);
  const headers = rows[0] ?? [];
  return rows.slice(1).filter((row) => row.some(Boolean)).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (character === "\"") {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function csvLine(values: string[]): string {
  return values.map((value) => `"${value.replace(/"/g, "\"\"")}"`).join(",");
}

function downloadText(fileName: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function requiredText(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value;
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error("Expected text.");
  return value;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
