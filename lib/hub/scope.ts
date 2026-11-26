// A member's view of the hub data: their own rows only. Mutators and status are passed through untouched.
// Call it inside useMemo keyed on the data and the person.
import type { Person } from "@/lib/people";
import type { HubData } from "@/lib/useHubData";

const same = (a: unknown, name: string) => typeof a === "string" && a.trim().toLowerCase() === name.trim().toLowerCase();

export function scopeHubData(data: HubData, person: Person): HubData {
  const name = person.name;
  const clients = data.clients.filter((c) => same(c.salesOwner, name));
  const clientIds = new Set(clients.map((c) => c.clientId).filter(Boolean));
  return {
    ...data,
    workLogs: data.workLogs.filter((l) => same(l.developerName, name)),
    deals: data.deals.filter((d) => same(d.marketingPerson, name)),
    interactions: data.interactions.filter((i) => same(i.marketingPerson, name)),
    clients,
    projects: data.projects.filter((p) => same(p.projectManager, name)),
    payments: data.payments.filter((p) => clientIds.has(p.clientId)),
    founderMatrix: data.founderMatrix.filter((f) => same(f.founder, name)),
    drafts: data.drafts.filter((d) => d.createdBy === person.id),
    activity: data.activity.filter((a) => a.actorId === person.id),
  };
}
