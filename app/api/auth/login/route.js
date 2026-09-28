import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signUser, sessionCookie } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

function setSession(response, user) {
  const c = sessionCookie(signUser(user));
  const cookie = c.name + "=" + encodeURIComponent(c.value) + "; Max-Age=" + c.maxAge + "; Path=/; HttpOnly; SameSite=Lax" + (c.secure ? "; Secure" : "");
  response.headers.set("Set-Cookie", cookie);
  return response;
}
function limited(response, retryAfter) {
  response.headers.set("Retry-After", String(retryAfter));
  return response;
}
export async function POST(request) {
  const ip = getClientIp(request);
  const ipLimit = rateLimit("login:ip:" + ip, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!ipLimit.allowed) return limited(Response.json({ error: "Too many login attempts. Please try again later." }, { status: 429 }), ipLimit.retryAfter);
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !password || password.length > 200) {
      return Response.json({ error: "Invalid email or password." }, { status: 400 });
    }
    const emailLimit = rateLimit("login:email:" + email, { limit: 8, windowMs: 15 * 60 * 1000 });
    if (!emailLimit.allowed) return limited(Response.json({ error: "Too many login attempts. Please try again later." }, { status: 429 }), emailLimit.retryAfter);
    const r = await db().query("select id,email,password_hash,created_at from users where email=$1", [email]);
    const user = r.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }
    delete user.password_hash;
    return setSession(Response.json({ user }), user);
  } catch (error) {
    console.error("Login error:", error);
    return Response.json({ error: "Login service error. Please try again." }, { status: 500 });
  }
}
