import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import type { UserSession } from "../../shared/types";
import { login } from "../src/api";
import { StringingTracker } from "./StringingTracker";
import "./stringing.css";

const sessionKey = "studio-mcleod-session";

function storedSession(): UserSession | null {
  const stored = localStorage.getItem(sessionKey);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as UserSession;
  } catch {
    localStorage.removeItem(sessionKey);
    return null;
  }
}

function StringingApp() {
  const [session, setSession] = useState<UserSession | null>(storedSession);

  function saveSession(next: UserSession) {
    localStorage.setItem(sessionKey, JSON.stringify(next));
    setSession(next);
  }

  function logout() {
    localStorage.removeItem(sessionKey);
    setSession(null);
  }

  if (session?.user.role !== "admin") {
    return (
      <main className="stringing-login">
        <div className="stringing-login-access">
          <div className="brand-mark">SM</div>
          <p className="eyebrow">STUDIO MCLEOD</p>
          <h1>Admin access required</h1>
          <p>The Stringing Tracker is available only to Studio McLeod administrators.</p>
          <button className="primary" type="button" onClick={() => window.location.assign("/")}>Back to Studio McLeod Tools</button>
          <button type="button" onClick={logout}>Sign out</button>
        </div>
      </main>
    );
  }
  if (session) return <StringingTracker token={session.token} email={session.user.email} onLogout={logout} />;
  return <StringingLogin onSession={saveSession} />;
}

function StringingLogin({ onSession }: { onSession: (session: UserSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSession(await login(email, password));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="stringing-login"><form onSubmit={(event) => void submit(event)}><div className="brand-mark">SM</div><p className="eyebrow">STUDIO MCLEOD</p><h1>Stringing tracker</h1><p>Sign in with your Studio McLeod tools account.</p><label>Email<input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input required autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error ? <div className="stringing-login-error">{error}</div> : null}<button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form></main>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><StringingApp /></React.StrictMode>);
