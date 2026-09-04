import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleDollarSign,
  Copy,
  Briefcase,
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  FolderOpen,
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
  MapPinned,
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
import { CURRENT_TEAMSPEAK_BRIDGE_VERSION } from "../../shared/teamspeak-bridge";
import { PROPERTY_PROJECT_TYPES, type ConstraintCheck, type ConstraintStatus, type PropertyConstraintSearchDepth, type PropertyConstraintsReport, type PropertyProjectType, type PropertySearchRecord, type PropertySearchStatus } from "../../shared/property-constraints";
import type { AdminUser, ConversionJob, DrawingScale, MeetingRoom, MeetingRoomId, Orientation, PaperSize, TeamSpeakBridgeStatus, UserRole, UserSession, VoiceCommand, VoiceCommandActionType, VoiceCommandInput, VoiceCommandModifier, VoiceCommandTargetApp } from "../../shared/types";
import { ApiRequestError, changePassword, clearMeetingRoomBoard, createJob, createMagicLink, createUser, createVoiceCommand, deleteJob, deleteUser, deleteVoiceCommand, downloadJobOutput, fetchReleaseNotes, fetchSessions, fetchVersion, importVoiceCommands, jobImageObjectUrl, joinMeetingRoom, leaveMeetingRoom, listJobs, listMeetingRooms, listPropertySearches, listUsers, listVoiceCommands, login, loginWithMagicLink, promotePropertySearch, retryJob, runVoiceCommand, savePropertySearch, searchPropertyConstraints, shareMeetingRoomBoard, updateUser, updateVoiceCommand } from "./api";

const SESSION_KEY = "studio-mcleod-session";
const MEETING_ROOMS_REFRESH_INTERVAL_MS = 1000;
const MIRO_AUTO_SHARE_INTERVAL_MS = 1000;
const TEAM_SPEAK_BRIDGE_CONTROL_URL = "http://127.0.0.1:37631";

type Module = "miro-converter" | "stringing" | "property-search-new" | "property-search-saved" | "property-search-projects" | "meeting-rooms" | "voice-commands" | "admin-users" | "release-notes" | "sessions";

interface TileGridSummary {
  rows: number;
  columns: number;
}

type AlertVariant = "error" | "info";

function currentModule(): Module {
  if (window.location.pathname.startsWith("/stringing")) return "stringing";
  if (window.location.pathname.startsWith("/miro-board-share-tool")) return "meeting-rooms";
  if (window.location.pathname.startsWith("/property-search/saved")) return "property-search-saved";
  if (window.location.pathname.startsWith("/property-search/projects")) return "property-search-projects";
  if (window.location.pathname.startsWith("/property-search/new")) return "property-search-new";
  if (window.location.pathname.startsWith("/property-constraints")) return "property-search-new";
  if (window.location.pathname.startsWith("/meeting-rooms")) return "meeting-rooms";
  if (window.location.pathname.startsWith("/voice-commands")) return "voice-commands";
  if (window.location.pathname.startsWith("/admin/users")) return "admin-users";
  if (window.location.pathname.startsWith("/admin/release-notes")) return "release-notes";
  if (window.location.pathname.startsWith("/admin/sessions")) return "sessions";
  return "miro-converter";
}

function teamSpeakBridgeInstallCommand(): string {
  const installUrl = `${window.location.origin}/teamspeak-bridge/install`;
  return [
    `curl -fsSL ${installUrl} -o /tmp/studio-mcleod-teamspeak-install.zsh`,
    "/bin/zsh /tmp/studio-mcleod-teamspeak-install.zsh",
  ].join("\n");
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
    if (module === "stringing") {
      window.location.assign("/stringing");
      return;
    }
    const paths: Record<Module, string> = {
      "miro-converter": "/miro-converter",
      "stringing": "/stringing",
      "property-search-new": "/property-search/new",
      "property-search-saved": "/property-search/saved",
      "property-search-projects": "/property-search/projects",
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
    return <MiroBoardShareLauncher session={session} onSessionExpired={expireSession} />;
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
            ) : activeModule === "meeting-rooms" ? (
              <MeetingRoomsModule session={session} onSessionExpired={expireSession} />
            ) : activeModule === "voice-commands" ? (
              <VoiceCommandsModule session={session} onSessionExpired={expireSession} />
            ) : activeModule === "property-search-new" ? (
              <PropertyConstraintsModule session={session} onSessionExpired={expireSession} onNavigate={navigateTo} />
            ) : activeModule === "property-search-saved" ? (
              <PropertySearchRecordsModule session={session} status="saved_search" onSessionExpired={expireSession} />
            ) : activeModule === "property-search-projects" ? (
              <PropertySearchRecordsModule session={session} status="active_project" onSessionExpired={expireSession} />
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
  { id: "stringing", label: "Stringing tracker", icon: CircleDollarSign },
  { id: "meeting-rooms", label: "Meeting rooms", icon: Video },
  { id: "voice-commands", label: "Vectorworks voice commands", icon: Mic },
];

const adminModules: ModuleItem[] = [
  { id: "admin-users", label: "Users", icon: Users },
  { id: "release-notes", label: "Release notes", icon: GitCommit },
  { id: "sessions", label: "Sessions", icon: History },
];

function SidebarNavButton({
  item,
  active,
  onNavigate,
}: {
  item: ModuleItem;
  active: boolean;
  onNavigate: (module: Module) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
        active ? "bg-ink text-white" : "text-muted hover:bg-stone-100 hover:text-ink"
      }`}
      onClick={() => onNavigate(item.id)}
    >
      <Icon size={18} className="shrink-0" />
      {item.label}
    </button>
  );
}

const propertySearchChildModules: ModuleItem[] = [
  { id: "property-search-new", label: "New search", icon: Search },
  { id: "property-search-saved", label: "Saved searches", icon: FolderOpen },
  { id: "property-search-projects", label: "Active projects", icon: Briefcase },
];

function isPropertySearchModule(module: Module): boolean {
  return module === "property-search-new" || module === "property-search-saved" || module === "property-search-projects";
}

function PropertySearchSidebarGroup({
  activeModule,
  onNavigate,
}: {
  activeModule: Module;
  onNavigate: (module: Module) => void;
}) {
  const active = isPropertySearchModule(activeModule);
  const [open, setOpen] = useState(active);
  const visible = active || open;

  useEffect(() => {
    if (!active) setOpen(false);
  }, [activeModule, active]);

  function openNewSearch() {
    setOpen(true);
    onNavigate("property-search-new");
  }

  function collapseWhenInactive() {
    if (!active) setOpen(false);
  }

  return (
    <div onMouseEnter={() => setOpen(true)} onMouseLeave={collapseWhenInactive} onBlur={collapseWhenInactive}>
      <button
        type="button"
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
          active ? "bg-ink text-white" : "text-muted hover:bg-stone-100 hover:text-ink"
        }`}
        onClick={openNewSearch}
        onFocus={() => setOpen(true)}
      >
        <MapPinned size={18} className="shrink-0" />
        <span className="min-w-0 flex-1">Property Search</span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${visible ? "rotate-0" : "-rotate-90"}`} />
      </button>
      {visible ? (
        <div className="mt-1 space-y-1 pl-6">
          {propertySearchChildModules.map((item) => (
            <SidebarChildNavButton key={item.id} item={item} active={activeModule === item.id} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SidebarChildNavButton({
  item,
  active,
  onNavigate,
}: {
  item: ModuleItem;
  active: boolean;
  onNavigate: (module: Module) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
        active ? "bg-ink text-white" : "text-muted hover:bg-stone-100 hover:text-ink"
      }`}
      onClick={() => onNavigate(item.id)}
    >
      <Icon size={15} className="shrink-0" />
      {item.label}
    </button>
  );
}

const moduleTitles: Record<Module, string> = {
  "miro-converter": "Miro converter",
  "stringing": "Stringing tracker",
  "property-search-new": "Property Search",
  "property-search-saved": "Saved Searches",
  "property-search-projects": "Active Projects",
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
        <SidebarNavButton item={modules[0]} active={activeModule === modules[0].id} onNavigate={onNavigate} />
        <PropertySearchSidebarGroup activeModule={activeModule} onNavigate={onNavigate} />
        {modules.slice(1).map((mod) => (
          <SidebarNavButton key={mod.id} item={mod} active={activeModule === mod.id} onNavigate={onNavigate} />
        ))}

        {role === "admin" ? (
          <>
            <p className="mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-muted">Administration</p>
            {adminModules.map((mod) => (
              <SidebarNavButton key={mod.id} item={mod} active={activeModule === mod.id} onNavigate={onNavigate} />
            ))}
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
  const [messageVariant, setMessageVariant] = useState<AlertVariant>("error");
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
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
      setMessageVariant("error");
      setMessage(error instanceof Error ? error.message : "Could not load recent jobs.");
    } finally {
      setJobsLoading(false);
    }
  }

  async function submitConversion() {
    if (selectedFiles.length === 0) {
      setMessageVariant("error");
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
    setCompletionMessage(null);
    try {
      const result = await createJob(session.token, formData);
      setJobs((current) => [result.job, ...current.filter((job) => job._id !== result.job._id)]);
      setSelectedFiles([]);
      setCompletionMessage(conversionCompletionMessage(result.job));
      await downloadJobOutput(session.token, result.job._id);
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessageVariant("error");
      setMessage(error instanceof Error ? error.message : "Conversion failed.");
      await refreshJobs();
    } finally {
      setBusy(false);
    }
  }

  async function retryConversion(jobId: string) {
    setMessage(null);
    setCompletionMessage(null);
    try {
      const result = await retryJob(session.token, jobId);
      setJobs((current) => [result.job, ...current.filter((job) => job._id !== result.job._id)]);
      setCompletionMessage(conversionCompletionMessage(result.job));
      await downloadJobOutput(session.token, result.job._id);
    } catch (error) {
      await refreshJobs();
      throw error;
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
          messageVariant={messageVariant}
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
        <JobsPanel jobs={jobs} loading={jobsLoading} token={session.token} onRefresh={() => void refreshJobs()} onDelete={(id) => deleteJob(session.token, id).then(() => refreshJobs())} onRetry={retryConversion} onError={setMessage} onSessionExpired={onSessionExpired} />
      </section>
      {completionMessage ? <CompletionDialog message={completionMessage} onDismiss={() => setCompletionMessage(null)} /> : null}
    </div>
  );
}

function conversionCompletionMessage(job: ConversionJob): string {
  const tileGrid = tileGridSummary(job.generatedImages);
  if (!tileGrid) return "Conversion complete.";
  return `Conversion complete. The image has been split into ${tileGrid.rows} rows and ${tileGrid.columns} columns due to Miro file size limitations. In Finder, select the files in name ascending order so they are easier to reassemble in Miro.`;
}

function tileGridSummary(images: ConversionJob["generatedImages"]): TileGridSummary | null {
  const tileIndexes = images
    .map((image) => image.originalFileName ?? image.key.split("/").at(-1) ?? image.key)
    .map(tileIndex)
    .filter((item): item is TileGridSummary => Boolean(item));

  if (!tileIndexes.length) return null;

  return {
    rows: Math.max(...tileIndexes.map((tile) => tile.rows)),
    columns: Math.max(...tileIndexes.map((tile) => tile.columns)),
  };
}

function tileIndex(fileName: string): TileGridSummary | null {
  const match = /_row(\d+)_col(\d+)\.jpg$/i.exec(fileName);
  if (!match?.[1] || !match[2]) return null;
  return {
    rows: Number(match[1]),
    columns: Number(match[2]),
  };
}

function PropertyConstraintsModule({ session, onSessionExpired, onNavigate }: { session: UserSession; onSessionExpired: () => void; onNavigate: (module: Module) => void }) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [projectReference, setProjectReference] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertyPostcode, setPropertyPostcode] = useState("");
  const [searchDepth, setSearchDepth] = useState<PropertyConstraintSearchDepth>("quick");
  const [projectTypes, setProjectTypes] = useState<PropertyProjectType[]>(["House extension"]);
  const [proposedWorks, setProposedWorks] = useState("");
  const [knownLocalAuthority, setKnownLocalAuthority] = useState("");
  const [notes, setNotes] = useState("");
  const [report, setReport] = useState<PropertyConstraintsReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savingSearch, setSavingSearch] = useState(false);
  const [savedMatches, setSavedMatches] = useState<PropertySearchRecord[]>([]);
  const [activeProjectMatches, setActiveProjectMatches] = useState<PropertySearchRecord[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const query = propertySearchMatchQuery(clientName, propertyAddress);
    if (query.length < 3) {
      setSavedMatches([]);
      setActiveProjectMatches([]);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      Promise.all([
        listPropertySearches(session.token, "saved_search", query),
        listPropertySearches(session.token, "active_project", query),
      ])
        .then(([saved, active]) => {
          if (cancelled) return;
          setSavedMatches(saved.searches.slice(0, 3));
          setActiveProjectMatches(active.searches.slice(0, 3));
        })
        .catch((error) => {
          if (cancelled) return;
          if (isUnauthorised(error)) {
            onSessionExpired();
          }
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [clientName, onSessionExpired, propertyAddress, session.token]);

  async function submitSearch() {
    setBusy(true);
    setMessage(null);
    setCopyMessage(null);
    try {
      const result = await searchPropertyConstraints(session.token, {
        clientName,
        clientEmail: clientEmail || undefined,
        clientPhone: clientPhone || undefined,
        projectReference: projectReference || undefined,
        propertyAddress,
        propertyPostcode,
        searchDepth,
        projectTypes,
        proposedWorks: proposedWorks || undefined,
        knownLocalAuthority: knownLocalAuthority || undefined,
        notes: notes || undefined,
      });
      setReport(result.report);
      setSaveMessage(null);
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not run the property search.");
    } finally {
      setBusy(false);
    }
  }

  async function copyReport() {
    if (!report) return;
    await navigator.clipboard.writeText(propertyConstraintsMarkdown(report));
    setCopyMessage("Report copied as Markdown.");
  }

  async function saveCurrentSearch() {
    if (!report) return;
    setSavingSearch(true);
    setSaveMessage(null);
    try {
      await savePropertySearch(session.token, report);
      setSaveMessage("Search saved.");
      const query = propertySearchMatchQuery(report.client.client_name, report.property.input_address);
      const saved = await listPropertySearches(session.token, "saved_search", query);
      setSavedMatches(saved.searches.slice(0, 3));
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setSaveMessage(error instanceof Error ? error.message : "Could not save the search.");
    } finally {
      setSavingSearch(false);
    }
  }

  function exportJson() {
    if (!report) return;
    downloadText(propertyReportFileName(report, "json"), JSON.stringify(report, null, 2), "application/json");
  }

  function exportMarkdown() {
    if (!report) return;
    downloadText(propertyReportFileName(report, "md"), propertyConstraintsMarkdown(report), "text/markdown");
  }

  function toggleProjectType(value: PropertyProjectType) {
    setProjectTypes((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
  }

  function updatePropertyAddress(value: string) {
    setPropertyAddress(value);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Property Search</h2>
          <p className="text-sm text-muted">Create an early-stage planning, heritage, environmental, access and title prompt report.</p>
        </div>
        {report ? (
          <div className="flex flex-wrap gap-2">
            <button className="secondary-button" type="button" onClick={() => void copyReport()}>
              <Copy size={16} />
              Copy report
            </button>
            <button className="secondary-button" type="button" onClick={() => void saveCurrentSearch()} disabled={savingSearch}>
              <Save size={16} />
              {savingSearch ? "Saving" : "Save search"}
            </button>
            <button className="secondary-button" type="button" onClick={exportJson}>
              <Download size={16} />
              JSON
            </button>
            <button className="secondary-button" type="button" onClick={exportMarkdown}>
              <FileText size={16} />
              Markdown
            </button>
          </div>
        ) : null}
      </div>

      {message ? <div className="mb-5"><Alert message={message} onDismiss={() => setMessage(null)} /></div> : null}
      {copyMessage ? <p className="mb-5 rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted">{copyMessage}</p> : null}
      {saveMessage ? <p className="mb-5 rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted">{saveMessage}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="space-y-4">
            <label className="field-label">
              Client name <RequiredMarker />
              <input className="field-input" value={clientName} onChange={(event) => setClientName(event.target.value)} />
            </label>
            <label className="field-label">
              Email address <OptionalMarker />
              <input className="field-input" type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} />
            </label>
            <label className="field-label">
              Phone number <OptionalMarker />
              <input className="field-input" type="tel" value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} />
            </label>
            <label className="field-label">
              Project reference <OptionalMarker />
              <input className="field-input" value={projectReference} onChange={(event) => setProjectReference(event.target.value)} />
            </label>
            <label className="field-label">
              Property address <RequiredMarker />
              <textarea className="field-input min-h-24 resize-y py-3" value={propertyAddress} placeholder="Include postcode if you have it" onChange={(event) => updatePropertyAddress(event.target.value)} />
            </label>
            <label className="field-label">
              Postcode <RequiredMarker />
              <input
                className="field-input"
                value={propertyPostcode}
                placeholder="Enter postcode manually"
                onChange={(event) => setPropertyPostcode(event.target.value.toUpperCase())}
                onBlur={() => setPropertyPostcode((current) => current.trim() ? formatPostcode(current) : "")}
              />
              <span className={`mt-2 block text-xs ${propertyPostcode ? "text-moss" : "text-muted"}`}>
                {propertyPostcode
                  ? "Postcode will be used for local authority lookup."
                  : "No confirmed postcode found yet."}
              </span>
            </label>
            <PropertySearchMatches
              activeProjectMatches={activeProjectMatches}
              savedMatches={savedMatches}
              onOpenActiveProjects={() => onNavigate("property-search-projects")}
              onOpenSavedSearches={() => onNavigate("property-search-saved")}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Search type</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  className={`rounded-lg border px-4 py-3 text-left transition ${searchDepth === "quick" ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}
                  type="button"
                  onClick={() => setSearchDepth("quick")}
                >
                  <span className="block text-sm font-semibold">Quick search</span>
                  <span className={`mt-1 block text-xs ${searchDepth === "quick" ? "text-white/80" : "text-muted"}`}>Readily available sources and clear manual flags.</span>
                </button>
                <button
                  className={`rounded-lg border px-4 py-3 text-left transition ${searchDepth === "in_depth" ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}
                  type="button"
                  onClick={() => setSearchDepth("in_depth")}
                >
                  <span className="block text-sm font-semibold">In-depth search</span>
                  <span className={`mt-1 block text-xs ${searchDepth === "in_depth" ? "text-white/80" : "text-muted"}`}>Adds local, title and planning-history prompts.</span>
                </button>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Project type <RequiredMarker /></p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROPERTY_PROJECT_TYPES.map((item) => {
                  const selected = projectTypes.includes(item);
                  return (
                    <label
                      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}
                      key={item}
                    >
                      <input
                        className="sr-only"
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleProjectType(item)}
                      />
                      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${selected ? "border-white bg-white text-ink" : "border-line bg-white"}`}>
                        {selected ? <Check size={12} /> : null}
                      </span>
                      <span>{item}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="field-label">
              Proposed works <OptionalMarker />
              <textarea className="field-input min-h-20 resize-y py-3" value={proposedWorks} onChange={(event) => setProposedWorks(event.target.value)} />
            </label>
            <label className="field-label">
              Known local authority <OptionalMarker />
              <input className="field-input" value={knownLocalAuthority} onChange={(event) => setKnownLocalAuthority(event.target.value)} />
            </label>
            <label className="field-label">
              Notes <OptionalMarker />
              <textarea className="field-input min-h-20 resize-y py-3" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <button className="primary-button w-full" type="button" disabled={busy || !clientName.trim() || !propertyAddress.trim() || !propertyPostcode.trim() || !projectTypes.length} onClick={() => void submitSearch()}>
              {busy ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />}
              Run search
            </button>
            <p className="text-xs text-muted"><RequiredMarker /> Required field</p>
          </div>
        </section>

        {report ? (
          <PropertyConstraintsReportView report={report} />
        ) : (
          <section className="grid min-h-[520px] place-items-center rounded-xl border border-dashed border-line bg-white p-8 text-center">
            <div className="max-w-md">
              <MapPinned className="mx-auto text-muted" size={34} />
              <h3 className="mt-4 text-base font-semibold text-ink">Ready for a property search</h3>
              <p className="mt-2 text-sm text-muted">Enter the client and address, choose quick or in-depth, then generate a property search report.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function PropertySearchMatches({
  activeProjectMatches,
  savedMatches,
  onOpenActiveProjects,
  onOpenSavedSearches,
}: {
  activeProjectMatches: PropertySearchRecord[];
  savedMatches: PropertySearchRecord[];
  onOpenActiveProjects: () => void;
  onOpenSavedSearches: () => void;
}) {
  if (!activeProjectMatches.length && !savedMatches.length) return null;
  return (
    <div className="rounded-lg border border-line bg-stone-50 p-3">
      <p className="text-sm font-semibold text-ink">Existing record found</p>
      <div className="mt-2 space-y-2">
        {activeProjectMatches.length ? (
          <PropertyMatchGroup label="Active Projects" matches={activeProjectMatches} onOpen={onOpenActiveProjects} />
        ) : null}
        {savedMatches.length ? (
          <PropertyMatchGroup label="Saved Searches" matches={savedMatches} onOpen={onOpenSavedSearches} />
        ) : null}
      </div>
    </div>
  );
}

function PropertyMatchGroup({ label, matches, onOpen }: { label: string; matches: PropertySearchRecord[]; onOpen: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <button className="text-xs font-semibold text-blue hover:underline" type="button" onClick={onOpen}>Open</button>
      </div>
      <div className="mt-1 space-y-1">
        {matches.map((match) => (
          <p className="truncate text-xs text-muted" key={match.id}>
            {match.projectNumber ? `${match.projectNumber} | ` : ""}{match.clientName} | {match.propertyAddress}
          </p>
        ))}
      </div>
    </div>
  );
}

function PropertySearchRecordsModule({ session, status, onSessionExpired }: { session: UserSession; status: PropertySearchStatus; onSessionExpired: () => void }) {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<PropertySearchRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<PropertySearchRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [projectNumber, setProjectNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const isActiveProjects = status === "active_project";

  useEffect(() => {
    void refreshRecords();
  }, [query, status]);

  async function refreshRecords() {
    setBusy(true);
    try {
      const result = await listPropertySearches(session.token, status, query);
      setRecords(result.searches);
      setSelectedRecord((current) => current ? result.searches.find((item) => item.id === current.id) ?? current : result.searches[0] ?? null);
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not load property records.");
    } finally {
      setBusy(false);
    }
  }

  async function promoteSelectedRecord() {
    if (!selectedRecord) return;
    setMessage(null);
    try {
      const result = await promotePropertySearch(session.token, selectedRecord.id, { projectNumber });
      setSelectedRecord(result.search);
      setProjectNumber("");
      setMessage("Saved search moved to Active Projects.");
      await refreshRecords();
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      setMessage(error instanceof Error ? error.message : "Could not create active project.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-ink">{isActiveProjects ? "Active Projects" : "Saved Searches"}</h2>
        <p className="text-sm text-muted">{isActiveProjects ? "Search live project records by job number, address or client." : "Search saved property reports by address, postcode, client or project reference."}</p>
      </div>

      {message ? <div className="mb-5"><Alert message={message} onDismiss={() => setMessage(null)} /></div> : null}

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <label className="field-label">
            Search
            <input className="field-input" value={query} placeholder="Client, address, postcode or project number" onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="mt-4 space-y-2">
            {busy ? <p className="text-sm text-muted">Loading...</p> : null}
            {!busy && !records.length ? <p className="text-sm text-muted">No records found.</p> : null}
            {records.map((record) => (
              <button
                className={`w-full rounded-lg border p-3 text-left transition ${selectedRecord?.id === record.id ? "border-ink bg-ink text-white" : "border-line bg-stone-50 text-ink hover:border-ink"}`}
                type="button"
                key={record.id}
                onClick={() => setSelectedRecord(record)}
              >
                <span className="block truncate text-sm font-semibold">{record.projectNumber ?? record.clientName}</span>
                <span className={`mt-1 block truncate text-xs ${selectedRecord?.id === record.id ? "text-white/80" : "text-muted"}`}>{record.propertyAddress}</span>
                <span className={`mt-1 block text-xs ${selectedRecord?.id === record.id ? "text-white/80" : "text-muted"}`}>{formatDateTime(record.updatedAt)}</span>
              </button>
            ))}
          </div>
        </section>

        {selectedRecord ? (
          <section className="space-y-5">
            <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-ink">{selectedRecord.projectNumber ?? selectedRecord.clientName}</h3>
                  <p className="mt-1 text-sm text-muted">{selectedRecord.propertyAddress}</p>
                  <p className="mt-1 text-xs text-muted">{selectedRecord.postcode} | Saved {formatDateTime(selectedRecord.createdAt)}</p>
                </div>
                <StatusPill status={selectedRecord.status === "active_project" ? "green" : "grey"} label={selectedRecord.status === "active_project" ? "Active project" : "Saved search"} />
              </div>
              {!isActiveProjects ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <input className="field-input max-w-64" value={projectNumber} placeholder="Project number" onChange={(event) => setProjectNumber(event.target.value)} />
                  <button className="primary-button" type="button" disabled={!projectNumber.trim()} onClick={() => void promoteSelectedRecord()}>
                    <Briefcase size={16} />
                    Convert to Active Project
                  </button>
                </div>
              ) : null}
            </div>
            <PropertyConstraintsReportView report={selectedRecord.report} />
          </section>
        ) : (
          <section className="grid min-h-[480px] place-items-center rounded-xl border border-dashed border-line bg-white p-8 text-center">
            <div className="max-w-md">
              <FolderOpen className="mx-auto text-muted" size={34} />
              <h3 className="mt-4 text-base font-semibold text-ink">No record selected</h3>
              <p className="mt-2 text-sm text-muted">Choose a property record from the list to view the saved report.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function PropertyConstraintsReportView({ report }: { report: PropertyConstraintsReport }) {
  const summaryChecks = keyFindingChecks(report).slice(0, 6);

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-ink">Property Search</h3>
            <p className="mt-1 text-sm text-ink">{report.client.client_name}</p>
            {report.client.email || report.client.phone ? (
              <p className="mt-1 text-xs text-muted">{[report.client.email, report.client.phone].filter(Boolean).join(" | ")}</p>
            ) : null}
            <p className="mt-1 text-sm text-muted">{report.property.resolved_address ?? report.property.input_address}</p>
            <p className="mt-1 text-xs text-muted">Search date: {formatDateTime(report.search.search_date)} | {searchDepthLabel(report.search.search_depth)} | {report.search.tool_version}</p>
          </div>
          <StatusPill status={report.search.overall_risk} label={`Overall: ${constraintStatusLabel(report.search.overall_risk)}`} />
        </div>
        <div className="mt-5 rounded-lg border border-line bg-stone-50">
          {propertyAtAGlanceItems(report).map((item) => (
            <div className="grid gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)_auto]" key={item.label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{item.label}</p>
              <p className="min-w-0 text-sm font-medium text-ink">{item.value}</p>
              {item.status ? <StatusPill status={item.status} label={constraintStatusLabel(item.status)} /> : null}
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(["red", "amber", "green", "grey"] as ConstraintStatus[]).map((status) => (
            <div className={`rounded-lg border px-4 py-3 ${constraintSummaryCardClass(status)}`} key={status}>
              <p className="text-xs font-semibold uppercase tracking-wide">{constraintStatusLabel(status)}</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{propertyConstraintStatusCount(report, status)}</p>
            </div>
          ))}
        </div>
      </div>

      {shouldShowTitleDetails(report) ? <PropertyTitleDetailsView report={report} /> : null}

      <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-ink">Key findings</h3>
        <div className="mt-3 space-y-3">
          {summaryChecks.length ? summaryChecks.map((check, index) => (
            <PropertyConstraintFinding check={check} key={`${check.source}-${check.name ?? check.result}-${index}`} />
          )) : <p className="text-sm text-muted">No key constraints in this result.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-ink">Recommended next steps</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
          {report.recommended_next_steps.map((step) => <li key={step}>{step}</li>)}
        </ul>
      </div>

      <div className="space-y-3">
        {propertyConstraintSections(report).map((section) => (
          <details className="rounded-xl border border-line bg-white shadow-sm" key={section.title} open={section.defaultOpen}>
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-ink">{section.title}</summary>
            <div className="space-y-3 border-t border-line p-5">
              {section.checks.map((check, index) => (
                <PropertyConstraintCheckRow check={check} key={`${section.title}-${check.source}-${check.name ?? check.result}-${index}`} />
              ))}
            </div>
          </details>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-ink">Source links</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {report.source_links.map((source) => (
            <a className="rounded-lg border border-line bg-stone-50 p-3 text-sm transition hover:border-ink" href={source.url} target="_blank" rel="noopener noreferrer" key={source.url}>
              <span className="flex items-center gap-2 font-medium text-ink"><ExternalLink size={15} />{source.label}</span>
              {source.notes ? <span className="mt-1 block text-xs text-muted">{source.notes}</span> : null}
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-ink">Caveats</h3>
        <div className="mt-3 space-y-3 text-sm text-muted">
          {report.caveats.map((caveat) => <p key={caveat}>{caveat}</p>)}
        </div>
      </div>
    </section>
  );
}

function PropertyTitleDetailsView({ report }: { report: PropertyConstraintsReport }) {
  const title = report.title_details;
  const leaseValues = title.lease ? [
    title.lease.term ? `Term: ${title.lease.term}` : undefined,
    title.lease.start_date ? `Start: ${title.lease.start_date}` : undefined,
    title.lease.end_date ? `End: ${title.lease.end_date}` : undefined,
  ].filter(Boolean).join(" | ") : "";

  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-ink">Title details</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <TitleDetailItem label="Tenure" value={titleTenureLabel(title.tenure)} />
        <TitleDetailItem label="Title number" value={title.title_numbers.length ? title.title_numbers.join(", ") : "Not known"} />
        <TitleDetailItem label="Lease" value={leaseValues || "Not known"} />
        <TitleDetailItem label="Proprietor" value={title.proprietor?.name ?? "Not known"} />
        <TitleDetailItem label="Proprietor type" value={titleProprietorTypeLabel(title.proprietor?.type ?? "unknown")} />
        <TitleDetailItem label="Confidence" value={titleConfidenceLabel(title.confidence)} />
      </div>
      <p className="mt-3 text-xs text-muted">{title.notes}</p>
    </div>
  );
}

function TitleDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-stone-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function PropertyConstraintFinding({ check }: { check: ConstraintCheck }) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-line bg-stone-50 p-3">
      <StatusPill status={check.status} label={constraintStatusLabel(check.status)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{check.name ?? readableResult(check.result)}</p>
        <p className="mt-1 text-sm text-muted">{check.architect_note}</p>
      </div>
    </div>
  );
}

function PropertyConstraintCheckRow({ check }: { check: ConstraintCheck }) {
  return (
    <div className="rounded-lg border border-line bg-stone-50 p-4">
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{check.name ?? readableResult(check.result)}</p>
          <p className="mt-1 text-xs text-muted">{check.source}</p>
        </div>
        <div className="sm:justify-self-end">
          <StatusPill status={check.status} label={`${constraintStatusLabel(check.status)} | ${readableResult(check.result)}`} />
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">{check.architect_note}</p>
      {check.verification_note ? <p className="mt-2 text-xs text-muted">Verification: {check.verification_note}</p> : null}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>Confidence: {check.confidence}</span>
        {check.distance_m !== null ? <span>Distance: {check.distance_m}m</span> : null}
        {check.raw_reference ? <span>Reference: {check.raw_reference}</span> : null}
        {check.source_url ? <a className="text-blue hover:underline" href={check.source_url} target="_blank" rel="noopener noreferrer">Source</a> : null}
      </div>
    </div>
  );
}

function StatusPill({ status, label }: { status: ConstraintStatus; label: string }) {
  const className: Record<ConstraintStatus, string> = {
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-green-100 text-green-800",
    grey: "bg-stone-200 text-muted",
  };
  return <span className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase ${className[status]}`}>{label}</span>;
}

function MeetingRoomsModule({ session, onSessionExpired }: { session: UserSession; onSessionExpired: () => void }) {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [teamSpeakBridgeStatuses, setTeamSpeakBridgeStatuses] = useState<TeamSpeakBridgeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busyRoomId, setBusyRoomId] = useState<MeetingRoomId | null>(null);

  useEffect(() => {
    void refreshRooms();
    const interval = window.setInterval(() => void refreshRooms(false), MEETING_ROOMS_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  async function refreshRooms(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const result = await listMeetingRooms(session.token);
      setRooms(result.rooms);
      setTeamSpeakBridgeStatuses(result.teamSpeakBridgeStatuses ?? []);
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
    <div className="mx-auto w-full max-w-7xl px-6 pb-56 pt-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Meeting rooms</h2>
          <p className="text-sm text-muted">Dashboard for Teamspeak, Meet and Miro board details for Hangout room automation</p>
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
        <>
          <TeamSpeakBridgePanel rooms={rooms} session={session} statuses={teamSpeakBridgeStatuses} />
          <section className="grid gap-5 xl:grid-cols-3">
            {rooms.map((room) => (
              <MeetingRoomCard
                busy={busyRoomId === room.id}
                room={room}
                session={session}
                key={room.id}
                onClearBoard={() => void clearBoard(room)}
                onJoin={() => void joinRoom(room)}
                onLeave={() => void leaveRoom(room)}
              />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function TeamSpeakBridgePanel({ rooms, session, statuses }: { rooms: MeetingRoom[]; session: UserSession; statuses: TeamSpeakBridgeStatus[] }) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [restartMessage, setRestartMessage] = useState<string | null>(null);
  const [restartingBridge, setRestartingBridge] = useState(false);
  const firstTimePreview = new URLSearchParams(window.location.search).get("bridgePreview") === "first-time";
  const previewStatuses = firstTimePreview ? [] : statuses;
  const currentStatus = previewStatuses.find((status) => status.userId === session.user.id);
  const currentBridge = currentStatus ? bridgeStatusView(currentStatus, rooms) : null;
  const statusLabel = currentBridge?.label ?? "Not connected";
  const statusClassName = currentBridge?.className ?? "status status-pending";
  const statusDetail = currentBridge?.detail ?? "No bridge has checked in for this Studio McLeod login.";
  const isFresh = currentBridge?.fresh === true;
  const needsUpdate = currentBridge?.needsUpdate === true;
  const showInstallPrompt = !isFresh || needsUpdate;

  async function restartBridge() {
    setRestartingBridge(true);
    setRestartMessage(null);
    try {
      const response = await fetch(`${TEAM_SPEAK_BRIDGE_CONTROL_URL}/restart`, { method: "POST" });
      if (!response.ok) throw new Error("Bridge restart request failed.");
      setRestartMessage("Restart requested. The bridge should check in again shortly.");
    } catch {
      setRestartMessage("Could not reach the local bridge. Use Install TeamSpeak Bridge to copy the setup command.");
    } finally {
      setRestartingBridge(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 py-3 shadow-[0_-8px_24px_rgba(30,27,24,0.08)] backdrop-blur lg:left-64">
      <div className="mx-auto grid w-full max-w-7xl gap-3 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.4fr)]">
      {showInstallPrompt ? (
        <section className="rounded-xl border border-line bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">{needsUpdate ? "Update TeamSpeak Bridge" : "Install TeamSpeak Bridge"}</h3>
              <p className="mt-1 text-sm text-muted">{needsUpdate ? "A newer bridge is available. Copy the command, paste it into Terminal, and press Return." : "Follow these first-time steps once on this Mac. Node is downloaded by the installer, so Homebrew is not needed."}</p>
            </div>
            <button
              className="secondary-button"
              type="button"
              title="Copies a Terminal command."
              onClick={() => {
                void navigator.clipboard.writeText(teamSpeakBridgeInstallCommand());
                setCopyMessage("Copied. Paste into Terminal and press Return.");
              }}
            >
              <Copy size={16} />
              {needsUpdate ? "Update" : "Copy"}
            </button>
          </div>
          {!needsUpdate ? <TeamSpeakBridgeOnboarding /> : null}
          {copyMessage ? <p className="mt-3 rounded-lg border border-line bg-stone-50 px-3 py-2 text-xs text-muted">{copyMessage}</p> : null}
        </section>
      ) : null}

      <section className={`rounded-xl border border-line bg-white px-5 py-4 shadow-sm ${showInstallPrompt ? "" : "lg:col-span-2"}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-sm font-semibold text-ink">TeamSpeak bridge</h3>
          <span className={statusClassName}>{statusLabel}</span>
          <span className="text-sm text-muted">{statusDetail}</span>
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bridge check-ins</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {previewStatuses.length ? previewStatuses.map((status) => {
              const view = bridgeStatusView(status, rooms);
              return (
                <div className="rounded-lg border border-line bg-stone-50 px-3 py-2" key={status.userId}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{status.name ?? status.email}</p>
                    <span className={view.className}>{view.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">Room: <span className="font-medium text-ink">{view.roomLabel}</span></p>
                  <p className="mt-1 text-xs text-muted">{view.detail}</p>
                </div>
              );
            }) : <p className="text-sm text-muted">No bridge check-ins yet.</p>}
          </div>
        </div>
        {currentStatus && !isFresh ? (
          <div className="mt-4 rounded-lg border border-line bg-stone-50 p-3">
            <p className="text-sm font-medium text-ink">Restart TeamSpeak Bridge</p>
            <p className="mt-1 text-sm text-muted">This asks the installed local bridge to restart itself. No Terminal step is needed while the bridge can still be reached.</p>
            <button className="mt-3 secondary-button" type="button" disabled={restartingBridge} onClick={() => void restartBridge()}>
              {restartingBridge ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Restart
            </button>
            {restartMessage ? <p className="mt-3 rounded-lg border border-line bg-white px-3 py-2 text-xs text-muted">{restartMessage}</p> : null}
          </div>
        ) : null}
      </section>
      </div>
    </div>
  );
}

interface TeamSpeakBridgeOnboardingStep {
  body: string;
  title: string;
}

const teamSpeakBridgeOnboardingSteps: TeamSpeakBridgeOnboardingStep[] = [
  {
    title: "Enable ClientQuery",
    body: "Open TeamSpeak 3, go to Preferences or Settings, find Addons or Plugins, enable ClientQuery, then restart TeamSpeak. If ClientQuery is not listed, install it from TeamSpeak Addons first.",
  },
  {
    title: "Copy the bridge command",
    body: "Use the Copy button above, open Terminal, paste the command, and press Return.",
  },
  {
    title: "Sign in when asked",
    body: "Enter the same Studio McLeod email and password used for this web app. The bridge then runs in the background.",
  },
  {
    title: "Check the result",
    body: "Return to this page. The bridge should show Running, and your Hangout room should appear when you move rooms in TeamSpeak.",
  },
];

function TeamSpeakBridgeOnboarding() {
  return (
    <div className="mt-4 rounded-lg border border-line bg-stone-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">First-time setup</p>
      <div className="mt-3 grid gap-3">
        {teamSpeakBridgeOnboardingSteps.map((step, index) => (
          <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3" key={step.title}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{index + 1}</span>
            <div>
              <p className="text-sm font-medium text-ink">{step.title}</p>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BridgeStatusView {
  className: string;
  detail: string;
  fresh: boolean;
  label: string;
  needsUpdate: boolean;
  roomLabel: string;
}

function bridgeStatusView(status: TeamSpeakBridgeStatus, rooms: MeetingRoom[]): BridgeStatusView {
  const lastSeenAgeMs = Date.now() - new Date(status.lastSeenAt).getTime();
  const fresh = lastSeenAgeMs < 30_000;
  const needsUpdate = status.bridgeVersion !== CURRENT_TEAMSPEAK_BRIDGE_VERSION;
  const room = rooms.find((item) => item.id === status.activeRoomId);
  const roomLabel = room?.name ?? status.channelName ?? "Not detected";
  if (fresh && status.errorMessage) {
    return {
      className: "status status-failed",
      detail: status.errorMessage,
      fresh,
      label: "Needs attention",
      needsUpdate,
      roomLabel,
    };
  }
  if (fresh && needsUpdate) {
    return {
      className: "status status-pending",
      detail: status.bridgeVersion ? `Bridge version ${status.bridgeVersion} is running. Update to ${CURRENT_TEAMSPEAK_BRIDGE_VERSION}.` : `This bridge has not reported a version. Update to ${CURRENT_TEAMSPEAK_BRIDGE_VERSION}.`,
      fresh,
      label: "Update available",
      needsUpdate,
      roomLabel,
    };
  }
  if (fresh) {
    return {
      className: "status status-completed",
      detail: `Last seen ${relativeBridgeTime(lastSeenAgeMs)}.`,
      fresh,
      label: "Running",
      needsUpdate,
      roomLabel,
    };
  }
  return {
    className: "status status-failed",
    detail: `Last seen ${relativeBridgeTime(lastSeenAgeMs)}. Restart TeamSpeak or rerun the bridge installer if this stays stale.`,
    fresh,
    label: "Needs attention",
    needsUpdate,
    roomLabel,
  };
}

function relativeBridgeTime(ageMs: number): string {
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

function MeetingRoomCard({
  busy,
  room,
  session,
  onClearBoard,
  onJoin,
  onLeave,
}: {
  busy: boolean;
  room: MeetingRoom;
  session: UserSession;
  onClearBoard: () => void;
  onJoin: () => void;
  onLeave: () => void;
}) {
  const joined = room.participants.some((participant) => participant.userId === session.user.id);

  return (
    <article className="rounded-xl border border-line bg-white">
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink">{room.name}</h3>
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

        <div className="rounded-lg border border-line bg-stone-50 p-3">
          <p className="text-sm font-medium text-ink">Meet link</p>
          {room.meetUrl ? (
            <p className="mt-2 break-all text-sm text-muted">{room.meetUrl}</p>
          ) : (
            <p className="mt-2 text-sm text-muted">No Meet link found in the TeamSpeak room description.</p>
          )}
          {room.meetUrl ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="secondary-button" href={room.meetUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} />
                Open Meet
              </a>
              <button className="secondary-button" type="button" onClick={() => void navigator.clipboard.writeText(room.meetUrl)}>
                <Copy size={16} />
                Copy
              </button>
            </div>
          ) : null}
          </div>

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
              <div className="mt-3 flex flex-nowrap gap-2">
                <a className="secondary-button" href={room.miroBoard.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={16} />
                  Open
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

function MiroBoardShareLauncher({ session, onSessionExpired }: { session: UserSession | null; onSessionExpired: () => void }) {
  const [message, setMessage] = useState("Preparing SM Board Share...");

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;
    let lastSharedKey: string | undefined;

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
        if (!session) {
          if (!cancelled) setMessage("SM Board Share is ready.");
          return;
        }
        await shareBoardFromLauncher(session);
        intervalId = window.setInterval(() => {
          void shareBoardFromLauncher(session, true).catch((caught: unknown) => {
            if (isUnauthorised(caught)) {
              onSessionExpired();
              return;
            }
            if (!cancelled) setMessage(caught instanceof Error ? caught.message : "Could not refresh the current Miro board.");
          });
        }, MIRO_AUTO_SHARE_INTERVAL_MS);
      } catch (caught) {
        if (isUnauthorised(caught)) {
          onSessionExpired();
          return;
        }
        if (!cancelled) setMessage(caught instanceof Error ? caught.message : "Could not prepare SM Board Share.");
      }
    }

    async function shareBoardFromLauncher(currentSession: UserSession, quiet = false) {
      const roomsResult = await listMeetingRooms(currentSession.token);
      const roomId = activeMeetingRoomId(roomsResult.rooms, roomsResult.teamSpeakBridgeStatuses, currentSession);
      const currentBoardInfo = await currentMiroBoardInfo();
      const sharedKey = `${roomId}:${currentBoardInfo.id}`;
      if (lastSharedKey === sharedKey) return;
      await shareMeetingRoomBoard(currentSession.token, roomId, { url: miroBoardUrl(currentBoardInfo.id) });
      lastSharedKey = sharedKey;
      if (quiet || cancelled) return;
      const roomName = roomsResult.rooms.find((room) => room.id === roomId)?.name ?? "the default room";
      setMessage(`Shared with ${roomName}.`);
    }

    void initialiseMiroLauncher();

    return () => {
      cancelled = true;
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [session]);

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
      const initialRoomId = activeMeetingRoomId(roomsResult.rooms, roomsResult.teamSpeakBridgeStatuses, session);
      setSelectedRoomId(initialRoomId);
      let currentBoardInfo: MiroBoardInfo;
      try {
        currentBoardInfo = await currentMiroBoardInfo();
        setBoardInfo(currentBoardInfo);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Miro did not provide the current board.");
        return;
      }
      try {
        await shareDetectedBoard(currentBoardInfo, initialRoomId, roomsResult.rooms);
      } catch (error) {
        if (isUnauthorised(error)) {
          onSessionExpired();
          return;
        }
        setMessage(error instanceof Error ? error.message : "Could not automatically share the Miro board.");
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

  async function shareDetectedBoard(currentBoardInfo: MiroBoardInfo, roomId: MeetingRoomId, availableRooms: MeetingRoom[]) {
    await shareMeetingRoomBoard(session.token, roomId, { url: miroBoardUrl(currentBoardInfo.id) });
    const roomName = availableRooms.find((room) => room.id === roomId)?.name ?? "the selected room";
    setMessage(`Automatically shared with ${roomName}.`);
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

function activeMeetingRoomId(rooms: MeetingRoom[], statuses: TeamSpeakBridgeStatus[], session: UserSession): MeetingRoomId {
  const status = statuses.find((item) => item.userId === session.user.id);
  const lastSeenAt = status ? new Date(status.lastSeenAt) : null;
  const lastSeenAgeMs = lastSeenAt ? Date.now() - lastSeenAt.getTime() : undefined;
  if (status?.activeRoomId && lastSeenAgeMs !== undefined && lastSeenAgeMs < 30_000) return status.activeRoomId;
  return rooms[0]?.id ?? "call-hangout-1";
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
  messageVariant: AlertVariant;
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

      {props.message ? <Alert message={props.message} variant={props.messageVariant} onDismiss={props.onDismissMessage} /> : null}
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
  onRetry,
  onError,
  onSessionExpired,
}: {
  jobs: ConversionJob[];
  loading: boolean;
  token: string;
  onRefresh: () => void;
  onDelete: (jobId: string) => Promise<void>;
  onRetry: (jobId: string) => Promise<void>;
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
          jobs.map((job) => <JobRow job={job} token={token} onDelete={onDelete} onRetry={onRetry} onError={onError} onSessionExpired={onSessionExpired} key={job._id} />)
        )}
      </div>
    </aside>
  );
}

function JobRow({ job, token, onDelete, onRetry, onError, onSessionExpired }: { job: ConversionJob; token: string; onDelete: (jobId: string) => Promise<void>; onRetry: (jobId: string) => Promise<void>; onError: (message: string) => void; onSessionExpired: () => void }) {
  const convertedBy = job.user?.name ?? job.user?.email ?? job.userId;
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);

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

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry(job._id);
    } catch (error) {
      if (isUnauthorised(error)) {
        onSessionExpired();
        return;
      }
      onError(error instanceof Error ? error.message : "Could not run the job again.");
    } finally {
      setRetrying(false);
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
          {job.status === "failed" ? (
            <button
              aria-label={retrying ? "Retrying job" : "Retry job"}
              className="status min-w-[3.75rem] border border-[#2563eb] bg-white text-[#2563eb] transition hover:bg-[#eff6ff] disabled:cursor-wait disabled:opacity-60"
              type="button"
              disabled={retrying}
              onClick={() => void handleRetry()}
            >
              {retrying ? "..." : "Retry"}
            </button>
          ) : null}
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

interface PropertyConstraintSection {
  title: string;
  defaultOpen: boolean;
  checks: ConstraintCheck[];
}

interface PropertyAtAGlanceItem {
  label: string;
  value: string;
  status?: ConstraintStatus;
}

function propertyAtAGlanceItems(report: PropertyConstraintsReport): PropertyAtAGlanceItem[] {
  const ownership = report.legal_ownership.leasehold_freehold_flag;
  const conservationArea = report.planning_heritage.conservation_area;
  const listedBuilding = report.planning_heritage.listed_building;
  return [
    {
      label: "Ownership type",
      value: report.title_details.tenure !== "not_known" ? titleTenureLabel(report.title_details.tenure) : "Not known. Manual check required.",
      status: ownership.status,
    },
    {
      label: "Local authority",
      value: report.property.local_authority ?? "Not detected",
      status: report.property.local_authority ? undefined : "grey",
    },
    {
      label: "Conservation area",
      value: constraintCheckSummaryValue(conservationArea),
      status: conservationArea.status,
    },
    {
      label: "Listed building",
      value: constraintCheckSummaryValue(listedBuilding),
      status: listedBuilding.status,
    },
  ];
}

function propertySearchMatchQuery(clientName: string, propertyAddress: string): string {
  return propertyAddress.trim() || clientName.trim();
}

function propertyConstraintSections(report: PropertyConstraintsReport): PropertyConstraintSection[] {
  return [
    { title: "Planning / Heritage", defaultOpen: true, checks: sortedConstraintChecks(Object.values(report.planning_heritage)) },
    { title: "Trees / Ecology / Landscape", defaultOpen: false, checks: sortedConstraintChecks(Object.values(report.trees_ecology_landscape)) },
    { title: "Flood / Ground / Environment", defaultOpen: false, checks: sortedConstraintChecks(Object.values(report.flood_ground_environment)) },
    { title: "Planning Potential", defaultOpen: false, checks: sortedConstraintChecks(Object.values(report.planning_potential)) },
    { title: "Access / Highways / Practical", defaultOpen: false, checks: sortedConstraintChecks(Object.values(report.access_highways_practical)) },
    { title: "Legal / Ownership", defaultOpen: false, checks: sortedConstraintChecks(Object.values(report.legal_ownership)) },
  ];
}

function sortedConstraintChecks(checks: ConstraintCheck[]): ConstraintCheck[] {
  return [...checks].sort((left, right) => constraintStatusSortOrder(left.status) - constraintStatusSortOrder(right.status));
}

function propertyConstraintStatusCount(report: PropertyConstraintsReport, status: ConstraintStatus): number {
  return propertyConstraintSections(report).flatMap((section) => section.checks).filter((check) => check.status === status).length;
}

function keyFindingChecks(report: PropertyConstraintsReport): ConstraintCheck[] {
  return propertyConstraintSections(report)
    .flatMap((section) => section.checks)
    .sort((left, right) => constraintStatusSortOrder(left.status) - constraintStatusSortOrder(right.status));
}

function constraintStatusSortOrder(status: ConstraintStatus): number {
  const order: Record<ConstraintStatus, number> = {
    red: 0,
    amber: 1,
    green: 2,
    grey: 3,
  };
  return order[status];
}

function constraintSummaryCardClass(status: ConstraintStatus): string {
  const classes: Record<ConstraintStatus, string> = {
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    green: "border-green-200 bg-green-50 text-green-800",
    grey: "border-line bg-stone-50 text-muted",
  };
  return classes[status];
}

function propertyConstraintsMarkdown(report: PropertyConstraintsReport): string {
  const keyFindings = keyFindingChecks(report)
    .map((check) => `- ${constraintStatusLabel(check.status)}: ${check.name ?? readableResult(check.result)} - ${readableResult(check.result)}. ${check.architect_note}`)
    .slice(0, 10);
  const detailSections = propertyConstraintSections(report).flatMap((section) => [
    "",
    `## ${section.title}`,
    "",
    ...section.checks.map((check) => [
      `- ${constraintStatusLabel(check.status)}: ${check.name ?? readableResult(check.result)} - ${readableResult(check.result)}`,
      `  Source: ${check.source}${check.source_url ? ` (${check.source_url})` : ""}`,
      `  Note: ${check.architect_note}`,
      check.verification_note ? `  Verification: ${check.verification_note}` : "",
    ].filter(Boolean).join("\n")),
  ]);
  return [
    "# Property Search",
    "",
    `Client: ${report.client.client_name}`,
    ...(report.client.email ? [`Email: ${report.client.email}`] : []),
    ...(report.client.phone ? [`Phone: ${report.client.phone}`] : []),
    `Project reference: ${report.client.project_reference ?? "Not provided"}`,
    `Property: ${report.property.resolved_address ?? report.property.input_address}`,
    `Search date: ${formatDateTime(report.search.search_date)}`,
    `Search type: ${searchDepthLabel(report.search.search_depth)}`,
    `Overall risk: ${constraintStatusLabel(report.search.overall_risk)}`,
    "",
    "## At a glance",
    "",
    ...propertyAtAGlanceItems(report).map((item) => `- ${item.label}: ${item.value}${item.status ? ` (${constraintStatusLabel(item.status)})` : ""}`),
    ...propertyTitleMarkdownLines(report),
    "",
    "## Key findings",
    "",
    ...(keyFindings.length ? keyFindings : ["- No key findings in this mock result."]),
    "",
    "## Recommended next steps",
    "",
    ...report.recommended_next_steps.map((step) => `- ${step}`),
    ...detailSections,
    "",
    "## Source links",
    "",
    ...report.source_links.map((source) => `- ${source.label}: ${source.url}${source.notes ? ` - ${source.notes}` : ""}`),
    "",
    "## Caveat",
    "",
    ...report.caveats,
  ].join("\n");
}

function propertyReportFileName(report: PropertyConstraintsReport, extension: "json" | "md"): string {
  const client = report.client.client_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
  const date = report.search.search_date.slice(0, 10);
  return `${date}-${client}-property-search.${extension}`;
}

function readableResult(value: string): string {
  return value.replace(/_/g, " ");
}

function constraintCheckSummaryValue(check: ConstraintCheck): string {
  if (check.result === "yes") return check.name ?? "Yes";
  if (check.result === "not_found" || check.result === "no") return "No";
  if (check.result === "manual_check_required") return "Manual check needed";
  if (check.result === "possible") return check.name ? `Possible: ${check.name}` : "Possible";
  if (check.result === "not_applicable") return "Not applicable";
  return "Check failed";
}

function shouldShowTitleDetails(report: PropertyConstraintsReport): boolean {
  return report.title_details.tenure !== "not_known";
}

function propertyTitleMarkdownLines(report: PropertyConstraintsReport): string[] {
  if (!shouldShowTitleDetails(report)) return [];
  return [
    "",
    "## Title details",
    "",
    `- Tenure: ${titleTenureLabel(report.title_details.tenure)}`,
    `- Title number(s): ${report.title_details.title_numbers.length ? report.title_details.title_numbers.join(", ") : "Not known"}`,
    `- Lease: ${titleLeaseMarkdownValue(report)}`,
    `- Proprietor: ${report.title_details.proprietor?.name ?? "Not known"}`,
    `- Proprietor type: ${titleProprietorTypeLabel(report.title_details.proprietor?.type ?? "unknown")}`,
    `- Confidence: ${titleConfidenceLabel(report.title_details.confidence)}`,
    `- Source: ${report.title_details.source}`,
    `- Notes: ${report.title_details.notes}`,
  ];
}

function titleTenureLabel(value: PropertyConstraintsReport["title_details"]["tenure"]): string {
  const labels: Record<PropertyConstraintsReport["title_details"]["tenure"], string> = {
    freehold: "Freehold",
    leasehold: "Leasehold",
    both_detected: "Both detected",
    not_known: "Not known",
  };
  return labels[value];
}

function titleProprietorTypeLabel(value: NonNullable<PropertyConstraintsReport["title_details"]["proprietor"]>["type"]): string {
  const labels: Record<NonNullable<PropertyConstraintsReport["title_details"]["proprietor"]>["type"], string> = {
    private_individual: "Private individual",
    company: "Company",
    public_body: "Public body",
    unknown: "Unknown",
  };
  return labels[value];
}

function titleConfidenceLabel(value: PropertyConstraintsReport["title_details"]["confidence"]): string {
  const labels: Record<PropertyConstraintsReport["title_details"]["confidence"], string> = {
    official_tenure: "Official tenure",
    inferred_share_of_freehold: "Inferred share of freehold",
    manual_check_required: "Manual check required",
  };
  return labels[value];
}

function titleLeaseMarkdownValue(report: PropertyConstraintsReport): string {
  const lease = report.title_details.lease;
  if (!lease) return "Not known";
  const values = [
    lease.term ? `Term: ${lease.term}` : undefined,
    lease.start_date ? `Start: ${lease.start_date}` : undefined,
    lease.end_date ? `End: ${lease.end_date}` : undefined,
  ].filter(Boolean);
  return values.length ? values.join("; ") : "Not known";
}

function constraintStatusLabel(status: ConstraintStatus): string {
  const labels: Record<ConstraintStatus, string> = {
    red: "Known constraint",
    amber: "Light constraint",
    green: "No constraint",
    grey: "Info unavailable",
  };
  return labels[status];
}

function searchDepthLabel(value: PropertyConstraintSearchDepth): string {
  return value === "in_depth" ? "In-depth search" : "Quick search";
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

function RequiredMarker() {
  return <span className="ml-1 text-sm font-semibold text-red-700" aria-label="Required">*</span>;
}

function OptionalMarker() {
  return <span className="ml-1 text-xs font-normal text-muted">Optional</span>;
}

function formatPostcode(value: string): string {
  const compact = value.toUpperCase().replace(/\s+/g, "");
  if (compact.length <= 3) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
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

function CompletionDialog({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-white p-5 shadow-xl">
        <p className="text-sm text-ink">{message}</p>
        <div className="mt-5 flex justify-end">
          <button className="primary-button" type="button" onClick={onDismiss}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function Alert({ message, variant = "error", onDismiss }: { message: string; variant?: AlertVariant; onDismiss: () => void }) {
  const classes: Record<AlertVariant, string> = {
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-blue/20 bg-blue/5 text-blue",
  };
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${classes[variant]}`}>
      <span>{message}</span>
      <button className="icon-only shrink-0" type="button" title="Dismiss" onClick={onDismiss}>
        <X size={16} />
      </button>
    </div>
  );
}
