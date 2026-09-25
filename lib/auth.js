import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const COOKIE_NAME = "session";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

export function signUser(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email },
    getSecret(),
    { expiresIn: "7d" }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

export function sessionCookie(token) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export async function getSessionUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export const sessionCookieName = COOKIE_NAME;
