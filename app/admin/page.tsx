import { requireAdmin } from "@/lib/auth/dal";
import { HubApp } from "@/components/HubApp";

export const metadata = { title: "Command Center · Axoraa Hub" };

export default async function AdminPage() {
  await requireAdmin();
  return <HubApp mode={{ kind: "admin" }} />;
}
