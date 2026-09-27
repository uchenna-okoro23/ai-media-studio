"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <main className="content" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <section className="panel" style={{ maxWidth: 560, width: "100%" }}>
        <label>APPLICATION ERROR</label>
        <h1>Something went wrong</h1>
        <p>The page encountered an unexpected error. Your saved account and projects are unchanged.</p>
        <button className="primary" onClick={() => reset()}>Try again</button>
        <a className="secondaryAction" href="/">Return to Dashboard</a>
      </section>
    </main>
  );
}
