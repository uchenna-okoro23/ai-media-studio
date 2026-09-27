"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "./components/Sidebar";

const tools = [
  ["AI Video", "/video", "Create the main video for your channel.", "V"],
  ["AI Image", "/image", "Create thumbnails and visual assets.", "I"],
  ["AI Audio", "/audio", "Prepare narration and voice assets.", "A"],
  ["AI Editor", "/editor", "Assemble and refine your finished video.", "E"],
  ["Captions", "/captions", "Prepare subtitles for publishing.", "C"],
  ["Storyboard", "/storyboard", "Plan the shots before production.", "S"],
];

export default function Home() {
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const me = await fetch("/api/auth/me").then((r) => r.json());
      setUser(me.user || null);
      if (me.user) {
        const a = await fetch("/api/account").then((r) => r.json());
        setAccount(a);
      }
    } catch {}
  }

  async function auth(e) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const r = await fetch("/api/auth/" + mode, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setNotice(d.error || "Account request failed.");
        return;
      }
      setShowAuth(false);
      setEmail("");
      setPassword("");
      await load();
    } catch {
      setNotice("Account service did not respond.");
    } finally {
      setBusy(false);
    }
  }

  function openAuth(m) {
    setMode(m);
    setNotice("");
    setShowAuth(true);
  }

  const remaining = account?.usage
    ? Math.max(0, account.usage.dailyLimit - account.usage.today)
    : 10;

  return (
    <main className="shell">
      <button className="mobileMenu" onClick={() => setMobileNav(true)}>☰</button>
      {mobileNav && <div className="navBackdrop" onClick={() => setMobileNav(false)} />}
      <Sidebar mobileOpen={mobileNav} onNavigate={() => setMobileNav(false)} />

      <section className="content dashboard">
        <header className="dashboardHeader">
          <div>
            <label>YOUTUBE PRODUCTION</label>
            <h1>Dashboard</h1>
            <span>Plan, create, edit and prepare videos for your channel.</span>
          </div>
          {!user && (
            <div className="authActions">
              <button className="upgrade" onClick={() => openAuth("login")}>Sign in</button>
              <button className="upgrade" onClick={() => openAuth("register")}>Create account</button>
            </div>
          )}
        </header>

        <section className="dashboardHero">
          <div>
            <label>READY TO CREATE</label>
            <h2>Build your next YouTube video</h2>
            <p>Start with a video, plan the story, then move through editing and captions.</p>
          </div>
          <div className="walletActions">
            <Link className="primaryAction" href="/video">Create video</Link>
            <Link className="secondaryAction" href="/storyboard">Plan video</Link>
          </div>
        </section>

        <section className="overviewGrid">
          <div className="overviewCard">
            <span>WALLET</span>
            <strong>₦{Number(account?.balance || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</strong>
            <small>Available for AI services</small>
          </div>
          <div className="overviewCard">
            <span>GENERATIONS TODAY</span>
            <strong>{account?.usage?.today || 0}</strong>
            <small>{remaining} free generations remaining</small>
          </div>
          <div className="overviewCard">
            <span>PROJECTS</span>
            <strong>{account?.usage?.total || 0}</strong>
            <small>Saved generations</small>
          </div>
          <div className="overviewCard">
            <span>WORKSPACE</span>
            <strong>Ready</strong>
            <small>Production tools available</small>
          </div>
        </section>

        <section className="dashboardSection">
          <div className="sectionHeading">
            <div>
              <label>PRODUCTION</label>
              <h2>Tools for your video workflow</h2>
            </div>
            <span>From idea to finished upload</span>
          </div>
          <div className="toolGrid">
            {tools.map(([name, href, desc, tag]) => (
              <Link className="toolCard" href={href} key={href}>
                <span className="toolIcon">{tag}</span>
                <div className="toolCopy">
                  <strong>{name}</strong>
                  <small>{desc}</small>
                </div>
                <b>→</b>
              </Link>
            ))}
          </div>
        </section>

        <section className="dashboardSection">
          <div className="sectionHeading">
            <div>
              <label>WORKFLOW</label>
              <h2>Production pipeline</h2>
            </div>
          </div>
          <div className="workspaceCards">
            <Link className="workspaceCard" href="/storyboard">
              <div><span>01 · PLAN</span><strong>Storyboard</strong><small>Turn an idea into planned shots.</small></div>
              <b>Open →</b>
            </Link>
            <Link className="workspaceCard" href="/video">
              <div><span>02 · CREATE</span><strong>AI Video</strong><small>Generate the video production assets.</small></div>
              <b>Open →</b>
            </Link>
            <Link className="workspaceCard" href="/editor">
              <div><span>03 · FINISH</span><strong>AI Editor</strong><small>Assemble and refine the final cut.</small></div>
              <b>Open →</b>
            </Link>
          </div>
        </section>

        <section className="dashboardSection">
          <div className="sectionHeading">
            <div>
              <label>CHANNEL ASSETS</label>
              <h2>Keep your channel consistent</h2>
            </div>
          </div>
          <div className="workspaceCards">
            <Link className="workspaceCard" href="/image">
              <div><span>THUMBNAILS</span><strong>AI Image</strong><small>Create visual assets for your videos.</small></div>
              <b>Open →</b>
            </Link>
            <Link className="workspaceCard" href="/brand-kit">
              <div><span>BRANDING</span><strong>Brand Kit</strong><small>Keep your channel identity organized.</small></div>
              <b>Open →</b>
            </Link>
            <Link className="workspaceCard" href="/assets">
              <div><span>LIBRARY</span><strong>Assets</strong><small>Manage reusable media for projects.</small></div>
              <b>Open →</b>
            </Link>
          </div>
        </section>

        <footer>AI Media Studio · <a href="/api/health">System status</a> · <Link href="/settings">Settings</Link></footer>
      </section>

      {showAuth && (
        <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setShowAuth(false); }}>
          <form className="auth" onSubmit={auth}>
            <button type="button" className="viewerClose" onClick={() => !busy && setShowAuth(false)}>×</button>
            <label>{mode === "login" ? "WELCOME BACK" : "CREATE ACCOUNT"}</label>
            <h2>{mode === "login" ? "Sign in to AI Media Studio" : "Create your account"}</h2>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" required />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength={mode === "register" ? 8 : undefined} required />
            {notice && <div className="notice">{notice}</div>}
            <button className="authBtn" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
            <button type="button" className="googleButton" onClick={() => { window.location.href = "/api/auth/google"; }} disabled={busy}>Continue with Google</button>
            <div className="authSwitch">
              {mode === "login" ? (
                <><span>Don’t have an account?</span><button type="button" onClick={() => { setMode("register"); setNotice(""); }}>Create account</button></>
              ) : (
                <><span>Already have an account?</span><button type="button" onClick={() => { setMode("login"); setNotice(""); }}>Sign in</button></>
              )}
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
