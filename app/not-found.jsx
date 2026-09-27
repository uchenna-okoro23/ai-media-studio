import Link from "next/link";

export default function NotFound() {
  return (
    <main className="content" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <section className="panel" style={{ maxWidth: 560, width: "100%" }}>
        <label>PAGE NOT FOUND</label>
        <h1>That page does not exist</h1>
        <p>The requested page could not be found.</p>
        <Link className="primaryAction" href="/">Return to Dashboard</Link>
      </section>
    </main>
  );
}
