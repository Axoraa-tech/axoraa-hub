// GET /api/agents: whether the assistant is configured, the model, and the agents this viewer may run.
import { getViewer } from "@/lib/auth/dal";
import { agentRoleOf, agentsFor } from "@/lib/agents/catalog";
import { AGENT_MODEL } from "@/lib/agents/server";
import { toPolicyViewer } from "@/lib/server/records";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "unauthorized", message: "Sign in to use the assistant." }, { status: 401 });
  const role = agentRoleOf(toPolicyViewer(viewer).category);
  return Response.json(
    { configured: !!process.env.ANTHROPIC_API_KEY?.trim(), model: AGENT_MODEL, agents: agentsFor(role, []) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
