import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signUser, sessionCookie } from "@/lib/auth";

function setSession(response, user) {
  const c = sessionCookie(signUser(user));
  const cookie = c.name + "=" + encodeURIComponent(c.value) + "; Max-Age=" + c.maxAge + "; Path=/; HttpOnly; SameSite=Lax" + (c.secure ? "; Secure" : "");
  response.headers.set("Set-Cookie", cookie);
  return response;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return Response.json({ error: "Email and password are required." }, { status: 400 });
    }

    const r = await db().query(
      "select id,email,password_hash,created_at from users where email=$1",
      [email]
    );
    const user = r.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }

    delete user.password_hash;
    return setSession(Response.json({ user }), user);
  } catch (error) {
    console.error("Login error:", error);
    return Response.json(
      { error: "Login service error. Please try again." },
      { status: 500 }
    );
  }
}
