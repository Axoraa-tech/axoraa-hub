// Public team directory (safe for the browser — no credentials here).
import type { UserRoleCategory } from "./types";

export interface Person {
  id: string; // login username
  name: string; // matches developerName / marketingPerson / salesOwner in the data
  role: "admin" | "member";
  category: UserRoleCategory | "admin";
  title: string;
}

export const PEOPLE: Person[] = [
  { id: "admin", name: "Administrator", role: "admin", category: "admin", title: "Super user" },
  { id: "akshar", name: "Akshar", role: "member", category: "founder", title: "Co-Founder · Tech Lead" },
  { id: "abhinav", name: "Abhinav", role: "member", category: "founder", title: "Co-Founder · Frontend Lead" },
  { id: "adnaan", name: "Adnaan", role: "member", category: "founder", title: "Co-Founder · Platform Lead" },
  { id: "bhuvan", name: "Bhuvan", role: "member", category: "founder", title: "Co-Founder · Mobile Lead" },
  { id: "kamil", name: "Kamil", role: "member", category: "marketing", title: "Field Marketing & BD" },
  { id: "anusha", name: "Anusha", role: "member", category: "marketing", title: "Enterprise Account Executive" },
  { id: "manish", name: "Manish", role: "member", category: "developer", title: "Backend & DevOps Engineer" },
  { id: "vinod", name: "Vinod", role: "member", category: "developer", title: "QA & Automation Engineer" },
  { id: "chakravarthi", name: "Chakravarthi", role: "member", category: "developer", title: "Software Engineering Intern" },
];

export const ACCOUNT_BY_NAME: Record<string, string> = Object.fromEntries(
  PEOPLE.filter((p) => p.role === "member").map((p) => [p.name, p.id])
);

export function findPerson(id: string): Person | undefined {
  return PEOPLE.find((p) => p.id === id.toLowerCase());
}
