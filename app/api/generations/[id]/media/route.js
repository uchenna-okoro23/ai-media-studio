import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request, { params }) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Authentication required.", { status: 401 });
  }

  const { id } = await params;
  const result = await db().query(
    "select output_url,type,status from generations where id=$1 and user_id=$2",
    [id, user.sub]
  );
  const generation = result.rows[0];

  if (!generation || generation.status !== "completed" || !generation.output_url) {
    return new Response("Media not available.", { status: 404 });
  }

  try {
    const upstream = await fetch(generation.output_url, { cache: "no-store" });
    if (!upstream.ok) {
      return new Response("Generated media has expired or is unavailable.", { status: 410 });
    }

    const headers = new Headers();
    const contentType = upstream.headers.get("content-type") || (generation.type === "AI Image" ? "image/webp" : "application/octet-stream");
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "private, max-age=3600");
    headers.set("Content-Disposition", generation.type === "AI Image" ? "inline" : "attachment");

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error("Media proxy error:", error);
    return new Response("Could not load generated media.", { status: 502 });
  }
}
