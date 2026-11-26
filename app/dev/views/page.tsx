import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ViewHarness } from "@/components/dev/ViewHarness";

export const metadata: Metadata = {
  title: "View harness",
  robots: { index: false, follow: false },
};

/** Dev-only: every view and overlay per role on local demo data, without signing in. */
export default function ViewHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <ViewHarness />
    </Suspense>
  );
}
