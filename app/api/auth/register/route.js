import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signUser, sessionCookie } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request) {
  const ip = getClientIp(request);
  const limit = rateLimit("register:ip:" + ip, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    const response = Response.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 });
    response.headers.set("Retry-After", String(limit.retryAfter));
    return response;
  }
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 200) {
      return Response.json({ error: "Use a valid email and a password between 8 and 200 characters." }, { status: 400 });
    }
    const hash = await bcrypt.hash(password, 12);
    const r = await db().query("insert into users(email,password_hash) values($1,$2) returning id,email,created_at", [email, hash]);
    const user = r.rows[0];
    const response = Response.json({ user }, { status: 201 });
    const c = sessionCookie(signUser(user));
    response.headers.set("Set-Cookie", c.name + "=" + encodeURIComponent(c.value) + "; Max-Age=" + c.maxAge + "; Path=/; HttpOnly; SameSite=Lax" + (c.secure ? "; Secure" : ""));
    return response;
  } catch (error) {
    if (error.code === "23505") return Response.json({ error: "An account with that email already exists." }, { status: 409 });
    console.error("Registration error:", error);
    return Response.json({ error: "Registration failed." }, { status: 500 });
  }
}
