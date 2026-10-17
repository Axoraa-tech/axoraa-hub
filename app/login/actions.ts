"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { findAccount, getPasswordHash, homePathFor } from "@/lib/auth/accounts";
import { verifyPassword } from "@/lib/auth/crypto";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export interface LoginState {
  error?: string;
  username?: string;
}

// Simple in-memory brute-force throttle (per username + IP). Resets on server restart.
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; first: number }>();

function isLocked(key: string) {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(key: string) {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(key, { count: 1, first: Date.now() });
  else entry.count++;
}

// A dummy hash so unknown usernames cost the same time as real ones.
const DUMMY_HASH = "pbkdf2.210000.AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!username || !password) return { error: "Enter your username and password.", username };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const throttleKey = `${username}|${ip}`;
  if (isLocked(throttleKey)) {
    return { error: "Too many attempts. Try again in 15 minutes.", username };
  }

  const account = findAccount(username);
  const hash = account ? getPasswordHash(account) : undefined;
  const ok = await verifyPassword(password, hash ?? DUMMY_HASH);

  if (!account || !hash || !ok) {
    recordFailure(throttleKey);
    return { error: "Username or password is incorrect.", username };
  }

  failures.delete(throttleKey);
  const token = await createSessionToken(account.id, account.role);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);

  const home = homePathFor(account);
  // Only follow `next` when it stays inside this account's area.
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") && (account.role === "admin" || next.startsWith(home))
      ? next
      : home;
  redirect(safeNext);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
