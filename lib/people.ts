// Public team directory (safe for the browser — no credentials here).
import { COMPANY_EMAIL } from "./company";
import type { UserRoleCategory } from "./types";

export interface Person {
  id: string; // login username
  name: string; // matches developerName / marketingPerson / salesOwner in the data
  role: "admin" | "member";
  category: UserRoleCategory | "admin";
  title: string;
  email?: string;
}

// Member addresses are the ones already listed in INITIAL_USER_PROFILES; nothing else is invented.
export const PEOPLE: Person[] = [
  { id: "admin", name: "Administrator", role: "admin", category: "admin", title: "Super user", email: COMPANY_EMAIL },
  { id: "akshar", name: "Akshar", role: "member", category: "founder", title: "Co-founder, tech lead", email: "akshar@axoraa.com" },
  { id: "abhinav", name: "Abhinav", role: "member", category: "founder", title: "Co-founder, frontend lead", email: "abhinav@axoraa.com" },
  { id: "adnaan", name: "Adnaan", role: "member", category: "founder", title: "Co-founder, platform lead", email: "adnaan@axoraa.com" },
  { id: "bhuvan", name: "Bhuvan", role: "member", category: "founder", title: "Co-founder, mobile lead", email: "bhuvan@axoraa.com" },
  { id: "kamil", name: "Kamil", role: "member", category: "marketing", title: "Field marketing and business development", email: "kamil@axoraa.com" },
  { id: "anusha", name: "Anusha", role: "member", category: "marketing", title: "Enterprise account executive", email: "anusha@axoraa.com" },
  { id: "manish", name: "Manish", role: "member", category: "developer", title: "Backend and DevOps engineer", email: "manish@axoraa.com" },
  { id: "vinod", name: "Vinod", role: "member", category: "developer", title: "QA and automation engineer", email: "vinod@axoraa.com" },
  { id: "chakravarthi", name: "Chakravarthi", role: "member", category: "developer", title: "Software engineering intern", email: "chakravarthi@axoraa.com" },
];

export const ACCOUNT_BY_NAME: Record<string, string> = Object.fromEntries(
  PEOPLE.filter((p) => p.role === "member").map((p) => [p.name, p.id])
);

export function findPerson(id: string): Person | undefined {
  return PEOPLE.find((p) => p.id === id.toLowerCase());
}

/** Members (never the administrator account) in one category. */
export function membersOf(category: UserRoleCategory): Person[] {
  return PEOPLE.filter((p) => p.role === "member" && p.category === category);
}

export const MEMBER_COUNT = PEOPLE.filter((p) => p.role === "member").length;
export const FOUNDER_NAMES: string[] = membersOf("founder").map((p) => p.name);
export const MARKETING_NAMES: string[] = membersOf("marketing").map((p) => p.name);
export const DEVELOPER_NAMES: string[] = membersOf("developer").map((p) => p.name);

/** Case-insensitive lookup by display name. */
export function personByName(name: string | null | undefined): Person | undefined {
  const key = (name ?? "").trim().toLowerCase();
  if (!key) return undefined;
  return PEOPLE.find((p) => p.name.toLowerCase() === key);
}
