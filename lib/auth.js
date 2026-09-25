import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const COOKIE_NAME = "ams_session";
const secret = () => {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is not configured.");
  return process.env.AUTH_SECRET;
};
export function signUser(user) { return jwt.sign({ sub: String(user.id), email: user.email }, secret(), { expiresIn: "30d" }); }
export function verifyToken(token) { return jwt.verify(token, secret()); }
export function sessionCookie(token) {
  return { name: COOKIE_NAME, value: token, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 };
}
export async function getSessionUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try { return verifyToken(token); } catch { return null; }
}
export const sessionCookieName = COOKIE_NAME;