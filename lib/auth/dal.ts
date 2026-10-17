// Data access layer for auth: the authoritative check used by pages, actions and route handlers.
// proxy.ts only does an optimistic redirect; every protected page calls one of these too.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { findAccount, type Account } from "./accounts";
import { readSessionToken, SESSION_COOKIE } from "./session";

export interface Viewer {
  account: Account;
  isAdmin: boolean;
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await readSessionToken(token);
  if (!session) return null;
  const account = findAccount(session.sub);
  // Role is re-read from the directory, so demoting an account takes effect immediately.
  if (!account) return null;
  return { account, isAdmin: account.role === "admin" };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) redirect(`/u/${viewer.account.id}`);
  return viewer;
}

/** A member may only open their own dashboard; the admin may open anyone's. */
export async function requireAccessTo(accountId: string): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isAdmin && viewer.account.id !== accountId.toLowerCase()) {
    redirect(`/u/${viewer.account.id}`);
  }
  return viewer;
}
