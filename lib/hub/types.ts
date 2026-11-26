// Who is looking at the hub. Isomorphic: imported by server routes and client components alike.
import type { Person } from "@/lib/people";
import type { UserRoleCategory } from "@/lib/types";

/** The role that decides navigation, scoping and permissions. */
export type ViewerCategory = UserRoleCategory | "admin";

export interface HubViewer {
  /** 'admin' on /admin; 'member' on /u/<id> (also when the administrator opens a member's page). */
  kind: "admin" | "member";
  /** Login username of the workspace owner ('admin' on /admin). */
  accountId: string;
  /** Display name; matches developerName, marketingPerson, salesOwner and projectManager in the data. */
  name: string;
  category: ViewerCategory;
  /** The directory entry for a member workspace; null on /admin. */
  person: Person | null;
  /** The workspace itself is the admin workspace (kind === 'admin'). */
  isAdmin: boolean;
  /** The signed-in account is the administrator, looking at a member's workspace. */
  viewerIsAdmin: boolean;
  /** isAdmin || viewerIsAdmin: may edit everything shown, subject to the exceptions in can(). */
  privileged: boolean;
  email?: string;
}
