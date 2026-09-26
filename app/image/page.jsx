"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";

export default function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [user, setUser] = useState(null);
  const [usage, setUsage] = useState({ today: 0, dailyLimit: 10 });
  const [output, setOutput] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const me = await fetch("/api/auth/me").then(r => r.json());
      setUser(me.user || null);
      if (!me.user) return;
      const account = await fetch("/api/account").then(r => r.json());
      const items = await fetch("/api/generations").then(r => r.json());
      if (account.usage) setUsage(account.usage);
      const images = (items.generations || []).filter(x => x.type === "AI Image");
      setHistory(images);
      const latest = images.find(x => x.status === "completed" && x.output_url);
      if (latest) setOutput({ id: latest.id, url: "/api/generations/" + latest.id + "/media", prompt: latest.prompt });
    } catch {}
  }

  async function generate() {
    if (!user) { setNotice("Sign in from the Dashboard before generating."); return; }
    if (!prompt.trim()) { setNotice("Enter a prompt first."); return; }
    if (usage.today >= usage.dailyLimit) { setNotice("Your daily free generation limit has been reached."); return; }
    setBusy(true);
    setNotice("");
    setOutput(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "AI Image", prompt })
      });
      const data = await response.json().catch(() => ({}));
      if (data.usage) setUsage(current => ({ ...current, today: data.usage.used }));
      if (response.ok && data.id) {
        setOutput({ id: data.id, url: "/api/generations/" + data.id + "/media", prompt });
        setNotice("Image generated successfully.");
        await load();
      } else {
        setNotice(data.error || "Image generation failed.");
      }
    } catch {
      setNotice("Could not reach the generation service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <button className="mobileMenu" onClick={() => setMobileNav(true)} aria-label="Open navigation">☰</button>
      {mobileNav && <div className="navBackdrop" onClick={() => setMobileNav(false)} />}
      <Sidebar mobileOpen={mobileNav} onNavigate={() => setMobileNav(false)} />
      <section className="content">
        <header>
          <div>
            <label>CREATE · AI IMAGE</label>
            <h1>AI Image Generator</h1>
            <span>Create polished visuals from a detailed prompt.</span>
          </div>
          {user ? <div className="accountChip">{user.email}</div> : <a className="upgrade" href="/">Sign in</a>}
        </header>

        <div className="workspace">
          <div className="panel">
            <label>IMAGE PROMPT</label>
            <h2>Describe your image</h2>
            <textarea maxLength={2000} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="A cinematic mountain village at sunrise, realistic photography, soft golden light..." />
            <div className="foot">
              <small>{prompt.length}/2000 · {usage.today}/{usage.dailyLimit} used today</small>
              <button onClick={generate} disabled={busy}>{busy ? "Generating..." : "✦ Generate image"}</button>
            </div>
            {notice && <div className="notice">{notice}</div>}
          </div>

          <div className="panel">
            <label>OUTPUT</label>
            <h2>Preview</h2>
            <div className="preview">
              {output ? (
                <div className="resultWrap">
                  <img className="generatedPreview" src={output.url} alt={output.prompt} />
                  <div className="resultActions">
                    <a href={output.url} target="_blank" rel="noreferrer">Open</a>
                    <a href={output.url} download="ai-media-studio-image.webp">Download</a>
                  </div>
                </div>
              ) : (
                <><b>✦</b><strong>Your generated image will appear here</strong><small>Generated images are stored in your persistent media history.</small></>
              )}
            </div>
          </div>
        </div>

        <div className="panel history">
          <label>RECENT</label>
          <h2>Image history</h2>
          {history.length === 0 ? <p>No images generated yet.</p> : history.slice(0, 8).map(item => (
            <div className="item" key={item.id}>
              <b>{item.prompt}</b>
              <small>{new Date(item.created_at).toLocaleString()} · {item.status}</small>
              {item.status === "completed" && <img className="historyImage" src={"/api/generations/" + item.id + "/media"} alt={item.prompt} />}
            </div>
          ))}
        </div>
        <footer>AI Media Studio · <a href="/">Dashboard</a> · <a href="/api/health">API health</a></footer>
      </section>
    </main>
  );
}
