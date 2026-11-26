import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/dal";
import { getFeatureFlags } from "@/lib/server/features";
import { HubApp } from "@/components/HubApp";
import { SkeletonPage } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const features = await getFeatureFlags({ isAdmin: true });
  return (
    <Suspense fallback={<SkeletonPage />}>
      <HubApp mode={{ kind: "admin" }} features={features} />
    </Suspense>
  );
}
