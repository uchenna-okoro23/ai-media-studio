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
  const [output, setOutput] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [viewer, setViewer] = useState(null);

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

      return {
        ok: response.ok,
        status: response.status,
        data: await response.json().catch(() => ({})),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function refreshAccount() {
    try {
      const me = (await fetchJson("/api/auth/me")).data;

      setUser(me.user || null);

      if (!me.user) {
        return;
      }

      const [accountResult, historyResult] = await Promise.all([
        fetchJson("/api/account"),
        fetchJson("/api/generations"),
      ]);

      const account = accountResult.data;
      const historyData = historyResult.data;

      if (account.usage) {
        setUsage(account.usage);
      }

      if (historyData.generations) {
        setHistory(historyData.generations);

        const latest = historyData.generations.find(
          (item) =>
            item.output_url &&
            item.status === "completed"
        );

        if (latest) {
          setOutput({
            id: latest.id,
            type: latest.type,
            url: "/api/generations/" + latest.id + "/media",
            prompt: latest.prompt,
          });
        }
      }
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
    if (!busy) {
      setShowAuth(false);
    }
  }

  function signInWithGoogle() {
    window.location.href = "/api/auth/google";
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

    if (usage.today >= usage.dailyLimit) {
      setNotice("Your daily free generation limit has been reached.");
      return;
    }

    setBusy(true);
    setNotice("");
    setOutput(null);

    try {
      const result = await fetchJson(
        "/api/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: active,
            prompt,
          }),
        },
        90000
      );

      const data = result.data;

      if (data.usage) {
        setUsage((current) => ({
          ...current,
          today: data.usage.used,
        }));
      }

      if (result.ok && data.url) {
        setOutput({
          id: data.id,
          type: active,
          url:
            active === "AI Image"
              ? "/api/generations/" + data.id + "/media"
              : data.url,
          prompt,
        });

        setNotice("Generation completed.");
      } else {
        setNotice(
          result.ok
            ? "Generation completed, but no output was returned."
            : data.error || "Generation failed."
        );
      }

      if (result.ok) {
        await refreshAccount();
      }
    } catch {
      setNotice("Could not reach the generation service.");
    } finally {
      setBusy(false);
    }
  }

  async function auth(event) {
    event.preventDefault();

    if (busy) {
      return;
    }

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

      let response;
      let data;

      try {
        response = await fetch("/api/auth/" + authMode, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            email: cleanEmail,
            password,
          }),
          signal: controller.signal,
        });

        data = await response.json().catch(() => ({}));
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        setNotice(data.error || "Account request failed.");
        return;
      }

      setShowAuth(false);
      setEmail("");
      setPassword("");
      setNotice("Account ready.");

      await refreshAccount();
    } catch {
      setNotice(
        "The account service did not respond. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  function openViewer(item) {
    if (!item?.url) {
      return;
    }

    setViewer({
      url: item.url,
      prompt: item.prompt || "",
    });
  }

  return (
    <main className="shell">
      <button
        type="button"
        className="mobileMenu"
        onClick={() => setMobileNav(true)}
        aria-label="Open navigation"
      >
        ☰
      </button>

      {mobileNav && (
        <div
          className="navBackdrop"
          onClick={() => setMobileNav(false)}
        />
      )}

      <aside
        className={
          mobileNav ? "side mobileOpen" : "side"
        }
      >
        <div className="brand">
          <b>✦ AI Media Studio</b>
          <small>Creator workspace</small>
        </div>

        <nav>
          <button
            type="button"
            className="active"
            onClick={() => setMobileNav(false)}
          >
            Dashboard
          </button>

          <p>CREATE</p>

          {tools.map((tool) => (
            <button
              type="button"
              className={
                active === tool ? "selected" : ""
              }
              onClick={() => {
                setActive(tool);
                setMobileNav(false);
              }}
              key={tool}
            >
              {tool}
            </button>
          ))}

          <p>WORKSPACE</p>

          <a
            href="/editor"
            onClick={() => setMobileNav(false)}
          >
            AI Editor
          </a>

          <a
            href="/settings"
            onClick={() => setMobileNav(false)}
          >
            Settings
          </a>
        </nav>

        <div className="usage">
          <span>Free usage</span>
          <b>
            {" "}
            {usage.today} / {usage.dailyLimit}
          </b>

          <div>
            <i
              style={{
                width:
                  Math.min(
                    100,
                    (usage.today /
                      usage.dailyLimit) *
                      100
                  ) + "%",
              }}
            />
          </div>

          <small>Limit resets daily.</small>
        </div>
      </aside>

      <section className="content">
        <header>
          <div>
            <label>CREATOR WORKSPACE</label>
            <h1>Turn ideas into media.</h1>
            <span>
              Generate, organize and refine creative
              concepts from one workspace.
            </span>
          </div>

          {user ? (
            <div className="accountChip">
              {user.email}
            </div>
          ) : (
            <div className="authActions">
              <button
                type="button"
                className="upgrade"
                onClick={openLogin}
              >
                Sign in
              </button>

              <button
                type="button"
                className="upgrade"
                onClick={openRegister}
              >
                Create account
              </button>
            </div>
          )}
        </header>

        <div className="cards">
          {tools.map((tool) => (
            <button
              type="button"
              className={
                active === tool
                  ? "card activeCard"
                  : "card"
              }
              onClick={() => setActive(tool)}
              key={tool}
            >
              <strong>{tool}</strong>

              <small>
                {tool === "AI Image"
                  ? "Create polished visuals from a prompt."
                  : tool === "AI Video"
                  ? "Generate short-form video with the configured video provider."
                  : tool === "AI Frame"
                  ? "Design keyframes and visual sequences."
                  : "Plan scenes, shots, and narrative beats."}
              </small>
            </button>
          ))}
        </div>

        <div className="workspace">
          <div className="panel">
            <label>{active}</label>

            <h2>
              Describe what you want to create
            </h2>

            <textarea
              maxLength={2000}
              value={prompt}
              onChange={(event) =>
                setPrompt(event.target.value)
              }
              placeholder="Describe your idea, style, mood, camera, subject and details..."
            />

            <div className="foot">
              <small>
                {prompt.length}/2000
              </small>

              <button
                type="button"
                onClick={generate}
                disabled={busy}
              >
                {busy
                  ? "Generating..."
                  : "✦ Generate"}
              </button>
            </div>

            {notice && (
              <div className="notice">
                {notice}
              </div>
            )}
          </div>

          <div className="panel">
            <label>OUTPUT</label>

            <h2>Preview</h2>

            <div className="preview">
              {output?.url ? (
                output.type === "AI Image" ? (
                  <div className="resultWrap">
                    <img
                      className="generatedPreview historyImage"
                      src={output.url}
                      alt={
                        output.prompt ||
                        "Generated image"
                      }
                      onClick={() =>
                        openViewer(output)
                      }
                    />

                    <div className="resultActions">
                      <button
                        type="button"
                        onClick={() =>
                          openViewer(output)
                        }
                      >
                        Open
                      </button>

                      <a
                        href={output.url}
                        download="ai-media-studio-image.webp"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ) : (
                  <a
                    className="outputLink"
                    href={output.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open generated {output.type}
                  </a>
                )
              ) : (
                <>
                  <b>✦</b>

                  <strong>
                    {usage.today >=
                    usage.dailyLimit
                      ? "Daily free limit reached"
                      : "Your creation will appear here"}
                  </strong>

                  <small>
                    Live provider output is returned
                    by the server without exposing
                    provider keys.
                  </small>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="panel history">
          <label>RECENT</label>

          <h2>Generation history</h2>

          {history.length === 0 ? (
            <p>
              No generations yet. Sign in and
              generate to create persistent history.
            </p>
          ) : (
            history.slice(0, 8).map((item) => (
              <div
                className="item"
                key={item.id}
              >
                <b>{item.prompt}</b>

                <small>
                  {item.type} ·{" "}
                  {new Date(
                    item.created_at
                  ).toLocaleString()}{" "}
                  · {item.status}
                </small>

                {item.output_url &&
                  item.status === "completed" &&
                  item.type === "AI Image" && (
                    <img
                      className="historyImage"
                      src={
                        "/api/generations/" +
                        item.id +
                        "/media"
                      }
                      alt={item.prompt}
                      onClick={() =>
                        openViewer({
                          url:
                            "/api/generations/" +
                            item.id +
                            "/media",
                          prompt: item.prompt,
                        })
                      }
                    />
                  )}
              </div>
            ))
          )}
        </div>

        <footer>
          AI Media Studio ·{" "}
          <a href="/api/health">
            API health
          </a>
        </footer>
      </section>

      {viewer && (
        <div
          className="viewer"
          onClick={() => setViewer(null)}
        >
          <div
            className="viewerInner"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="viewerClose"
              onClick={() => setViewer(null)}
              aria-label="Close image viewer"
            >
              ×
            </button>

            <img
              src={viewer.url}
              alt={
                viewer.prompt ||
                "Generated image"
              }
            />

            <p>{viewer.prompt}</p>

            <a
              href={viewer.url}
              download="ai-media-studio-image.webp"
            >
              Download image
            </a>
          </div>
        </div>
      )}

      {showAuth && (
        <div
          className="modal"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeAuth();
            }
          }}
        >
          <form
            className="auth"
            onSubmit={auth}
          >
            <button
              type="button"
              className="viewerClose"
              onClick={closeAuth}
              aria-label="Close"
            >
              ×
            </button>

            <label>
              {authMode === "login"
                ? "WELCOME BACK"
                : "CREATE ACCOUNT"}
            </label>

            <h2>
              {authMode === "login"
                ? "Sign in to AI Media Studio"
                : "Create your account"}
            </h2>

            <p>
              {authMode === "login"
                ? "Access your generations, history and workspace."
                : "Start creating with your free daily generations."}
            </p>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Email address"
              autoComplete="email"
              required
            />

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Password"
              autoComplete={
                authMode === "login"
                  ? "current-password"
                  : "new-password"
              }
              minLength={
                authMode === "register"
                  ? 8
                  : undefined
              }
              required
            />

            <button
              type="submit"
              disabled={busy}
            >
              {busy
                ? "Please wait..."
                : authMode === "login"
                ? "Sign in"
                : "Create account"}
            </button>

            <div className="authDivider">
              <span>OR</span>
            </div>

            <button
              type="button"
              className="googleButton"
              onClick={signInWithGoogle}
              disabled={busy}
            >
              Continue with Google
            </button>

            <div className="authSwitch">
              {authMode === "login" ? (
                <>
                  <span>
                    Don't have an account?
                  </span>

                  <button
                    type="button"
                    onClick={openRegister}
                  >
                    Create account
                  </button>
                </>
              ) : (
                <>
                  <span>
                    Already have an account?
                  </span>

                  <button
                    type="button"
                    onClick={openLogin}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      )}
    </main>
  );
          }
