import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/dal";
import { homePathFor } from "@/lib/auth/accounts";

export default async function Home() {
  const viewer = await getViewer();
  redirect(viewer ? homePathFor(viewer.account) : "/login");
}
