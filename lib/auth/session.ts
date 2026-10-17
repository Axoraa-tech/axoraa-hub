// Stateless signed session token: base64url(payload).signature
// Safe to import from proxy.ts and from server code. Never import from client components.
import { fromBase64Url, hmacSign, hmacVerify, toBase64Url } from "./crypto";

export const SESSION_COOKIE = "axoraa_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export type SessionRole = "admin" | "member";

export interface SessionPayload {
  sub: string; // account id, e.g. "akshar" or "admin"
  role: SessionRole;
  iat: number;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is missing or shorter than 32 characters. See .env.example.");
  }
  return secret;
}

export async function createSessionToken(sub: string, role: SessionRole): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub, role, iat: now, exp: now + SESSION_TTL_SECONDS };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSign(body, getSecret());
  return `${body}.${sig}`;
}

export async function readSessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    if (!(await hmacVerify(body, sig, getSecret()))) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.role !== "admin" && payload.role !== "member") return null;
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
