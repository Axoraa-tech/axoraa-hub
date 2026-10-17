import { notFound } from "next/navigation";
import { requireAccessTo } from "@/lib/auth/dal";
import { findPerson } from "@/lib/people";
import { HubApp } from "@/components/HubApp";

export default async function MemberPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const viewer = await requireAccessTo(userId);
  const person = findPerson(userId);
  if (!person || person.role !== "member") notFound();
  return <HubApp mode={{ kind: "member", person, viewerIsAdmin: viewer.isAdmin }} />;
}
