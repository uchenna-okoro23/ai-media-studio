"use client";

import { useEffect, useState } from "react";

const tools = ["AI Image", "AI Video", "AI Frame", "Storyboard"];

export default function Home() {
  const [active, setActive] = useState("AI Image");
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [usage, setUsage] = useState({ today: 0, dailyLimit: 10 });

  useEffect(() => {
    refreshAccount();
  }, []);

  async function fetchJson(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "same-origin",
        ...options,
        signal: controller.signal,
      });
      return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
    } finally {
      clearTimeout(timer);
    }
  }

  async function refreshAccount() {
    try {
      const me = (await fetchJson("/api/auth/me")).data;
      setUser(me.user || null);
      if (!me.user) return;

      const [aResult, hResult] = await Promise.all([
        fetchJson("/api/account"),
        fetchJson("/api/generations"),
      ]);
      const a = aResult.data;
      const h = hResult.data;
      if (a.usage) setUsage(a.usage);
      if (h.generations) setHistory(h.generations);
    } catch {
      setUser(null);
    }
  }

  function openLogin() {
    setAuthMode("login");
    setNotice("");
    setShowAuth(true);
  }

  function openRegister() {
    setAuthMode("register");
    setNotice("");
    setShowAuth(true);
  }

  function closeAuth() {
    if (!busy) setShowAuth(false);
  }

  async function generate() {
    if (!user) {
      openLogin();
      setNotice("Sign in to use your free generations.");
      return;
    }
    if (!prompt.trim()) {
      setNotice("Enter a prompt first.");
      return;
    }

    setBusy(true);
    setNotice("");
    try {
      const result = await fetchJson("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: active, prompt }),
      });
      const data = result.data;
      if (data.usage) setUsage((u) => ({ ...u, today: data.usage.used }));
      setNotice(result.ok ? "Generation completed." : data.error || "Generation failed.");
      if (result.ok) await refreshAccount();
    } catch {
      setNotice("Could not reach the generation service.");
    } finally {
      setBusy(false);
    }
  }

  async function auth(event) {
    event.preventDefault();
    if (busy) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setNotice("Enter your email and password.");
      return;
    }
    if (authMode === "register" && password.length < 8) {
      setNotice("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      let res;
      let data;
      try {
        res = await fetch("/api/auth/" + authMode, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email: cleanEmail, password }),
          signal: controller.signal,
        });
        data = await res.json().catch(() => ({}));
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        setNotice(data.error || "Account request failed.");
        return;
      }

      setShowAuth(false);
      setEmail("");
      setPassword("");
      setNotice("Account ready.");
      await refreshAccount();
    } catch {
      setNotice("The account service did not respond. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <aside className="side">
        <div className="brand">
          <b>✦ AI Media Studio</b>
          <small>Creator workspace</small>
        </div>
        <nav>
          <button type="button" className="active">Dashboard</button>
          <p>CREATE</p>
          {tools.map((t) => (
            <button type="button" className={active === t ? "selected" : ""} onClick={() => setActive(t)} key={t}>
              {t}
            </button>
          ))}
          <p>WORKSPACE</p>
          <a href="/editor">AI Editor</a>
          <a href="/settings">Settings</a>
        </nav>
        <div className="usage">
          <span>Free usage</span><b> {usage.today} / {usage.dailyLimit}</b>
          <div><i style={{ width: (usage.today / usage.dailyLimit * 100) + "%" }} /></div>
          <small>Limit resets daily.</small>
        </div>
      </aside>

      <section className="content">
        <header>
          <div>
            <label>CREATOR WORKSPACE</label>
            <h1>Turn ideas into media.</h1>
            <span>Generate, organize and refine creative concepts from one workspace.</span>
          </div>
          {user ? (
            <div className="accountChip">{user.email}</div>
          ) : (
            <div className="authActions">
              <button type="button" className="upgrade" onClick={openLogin}>Sign in</button>
              <button type="button" className="upgrade" onClick={openRegister}>Create account</button>
            </div>
          )}
        </header>

        <div className="cards">
          {tools.map((t) => (
            <button type="button" className={active === t ? "card activeCard" : "card"} onClick={() => setActive(t)} key={t}>
              <strong>{t}</strong>
              <small>
                {t === "AI Image" ? "Create polished visuals from a prompt."
                  : t === "AI Video" ? "Generate short-form video with the configured video provider."
                  : t === "AI Frame" ? "Design keyframes and visual sequences."
                  : "Plan scenes, shots, and narrative beats."}
              </small>
            </button>
          ))}
        </div>

        <div className="workspace">
          <div className="panel">
            <label>{active}</label>
            <h2>Describe what you want to create</h2>
            <textarea maxLength={2000} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your idea, style, mood, camera, subject and details..." />
            <div className="foot">
              <small>{prompt.length}/2000</small>
              <button type="button" onClick={generate} disabled={busy}>{busy ? "Generating..." : "✦ Generate"}</button>
            </div>
            {notice && <div className="notice">{notice}</div>}
          </div>

          <div className="panel">
            <label>OUTPUT</label>
            <h2>Preview</h2>
            <div className="preview">
              <b>✦</b>
              <strong>{usage.today >= usage.dailyLimit ? "Daily free limit reached" : "Your creation will appear here"}</strong>
              <small>Live provider output is returned by the server without exposing provider keys.</small>
            </div>
          </div>
        </div>

        <div className="panel history">
          <label>RECENT</label>
          <h2>Generation history</h2>
          {history.length === 0 ? <p>No generations yet. Sign in and generate to create persistent history.</p> : history.slice(0, 8).map((x) => (
            <div className="item" key={x.id}>
              <b>{x.prompt}</b>
              <small>{x.type} · {new Date(x.created_at).toLocaleString()} · {x.status}</small>
            </div>
          ))}
        </div>

        <footer>AI Media Studio · <a href="/api/health">API health</a></footer>

        {showAuth && (
          <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) closeAuth(); }}>
            <form className="auth" onSubmit={auth}>
              <button type="button" className="close" onClick={closeAuth} disabled={busy} aria-label="Close">×</button>
              <label>ACCOUNT</label>
              <h2>{authMode === "login" ? "Welcome back" : "Create your account"}</h2>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" required />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters)" autoComplete={authMode === "login" ? "current-password" : "new-password"} required minLength={authMode === "register" ? 8 : 1} />
              <button type="submit" className="authBtn" disabled={busy}>{busy ? "Please wait..." : authMode === "login" ? "Sign in" : "Create account"}</button>
              <div className="googleDivider"><span>or</span></div>
              <a className="authBtn googleBtn" href="/api/auth/google">Continue with Google</a>
              <button type="button" className="switch" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setNotice(""); }}>
                {authMode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
