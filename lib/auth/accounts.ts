// Server-side account directory. Do NOT import from client components:
// it reads password hashes from the environment.
//
// Each account logs in with its username + password. The password hash lives in an env var
// named AUTH_HASH_<USERNAME> (e.g. AUTH_HASH_AKSHAR). Generate one with:
//   node scripts/hash-password.mjs "the-password"
// Accounts without a hash configured simply cannot log in.

import { PEOPLE, type Person } from "../people";

export type Account = Person;

export const ACCOUNTS: Account[] = PEOPLE;

export function findAccount(id: string): Account | undefined {
  const key = id.trim().toLowerCase();
  return ACCOUNTS.find((a) => a.id === key);
}

export function getPasswordHash(account: Account): string | undefined {
  const value = process.env[`AUTH_HASH_${account.id.toUpperCase()}`];
  return value && value.startsWith("pbkdf2.") ? value : undefined;
}

/** Where an account lands after login. */
export function homePathFor(account: Pick<Account, "id" | "role">): string {
  return account.role === "admin" ? "/admin" : `/u/${account.id}`;
}
