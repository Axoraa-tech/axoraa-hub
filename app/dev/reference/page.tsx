import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReferencePage } from "@/components/dev/ReferencePage";

export const metadata: Metadata = {
  title: "Design reference",
  robots: { index: false, follow: false },
};

/** Dev-only design gate: every primitive on mock data, in light and dark. */
export default function DesignReferencePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ReferencePage />;
}
