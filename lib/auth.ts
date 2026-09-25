import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export type AuthUser = {
  id: string;
  email: string;
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
  return jwt.sign(user, getSecret(), { expiresIn: "7d" });
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
