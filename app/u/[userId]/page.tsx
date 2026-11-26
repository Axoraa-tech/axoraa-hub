import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer, requireAccessTo } from "@/lib/auth/dal";
import { findPerson } from "@/lib/people";
import { getFeatureFlags } from "@/lib/server/features";
import { HubApp } from "@/components/HubApp";
import { SkeletonPage } from "@/components/ui/Skeleton";

// Same check as the page, without redirecting: anything short of full access gets the generic
// title, so the tab never reveals whether a person exists.
export async function generateMetadata({ params }: PageProps<"/u/[userId]">): Promise<Metadata> {
  const generic: Metadata = { title: { absolute: "Axoraa Hub" } };
  const { userId } = await params;
  const viewer = await getViewer();
  if (!viewer) return generic;
  if (!viewer.isAdmin && viewer.account.id !== userId.toLowerCase()) return generic;
  const person = findPerson(userId);
  if (!person || person.role !== "member") return generic;
  return { title: person.name };
}

export default async function MemberPage({ params }: PageProps<"/u/[userId]">) {
  const { userId } = await params;
  const viewer = await requireAccessTo(userId);
  const person = findPerson(userId);
  if (!person || person.role !== "member") notFound();
  const features = await getFeatureFlags({ isAdmin: viewer.isAdmin });
  return (
    <Suspense fallback={<SkeletonPage />}>
      <HubApp mode={{ kind: "member", person, viewerIsAdmin: viewer.isAdmin }} features={features} />
    </Suspense>
  );
}
