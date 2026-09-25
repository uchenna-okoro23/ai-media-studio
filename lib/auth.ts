import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export type AuthUser = {
  id: string;
  email: string;
  sub?: string;
};

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(user: AuthUser) {
  return jwt.sign({ sub: user.id, email: user.email }, getSecret(), {
    expiresIn: "7d",
  });
}

export function signUser(user: AuthUser) {
  return signToken(user);
}

export function verifyToken(token: string) {
  return jwt.verify(token, getSecret()) as AuthUser;
}

export function createToken(user: AuthUser) {
  return signToken(user);
}

export function verifyAuthToken(token: string) {
  return verifyToken(token);
}

export function sessionCookie(token: string) {
  return {
    name: "session",
    value: token,
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}
