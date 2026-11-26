// POST /api/agents/[key]: runs one agent and streams AgentRunEvents as Server-Sent Events.
// Before the first byte every failure is JSON { error, message } with its status; after it, every
// failure is an SSE 'error' event and the stream closes.
import { getViewer } from "@/lib/auth/dal";
import { agentEntry, agentRoleOf } from "@/lib/agents/catalog";
import { AgentContextError, loadAgentContext } from "@/lib/agents/context";
import { AGENT_DEFS } from "@/lib/agents/registry";
import { agentRunRequestSchema, issueMessages, REQUEST_MAX_BYTES } from "@/lib/agents/schemas";
import { runAgent } from "@/lib/agents/server";
import { encodeAgentEvent, type AgentErrorCode, type AgentOutput, type AgentRunRequest } from "@/lib/agents/types";
import { toPolicyViewer } from "@/lib/server/records";

export const maxDuration = 300;

const PING_MS = 15_000;
const HOUR_MS = 60 * 60 * 1000;

function fail(status: number, error: AgentErrorCode, message: string, extra?: Record<string, unknown>) {
  return Response.json({ error, message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/* ------------------------------------------------------------------ rate limit (per server instance) */
// Best effort: counters live in this instance's memory, so on serverless the cap holds per warm instance
// only. A hard global cap needs shared storage (KV); that is outside this package's files.

const runs = new Map<string, number[]>();
const active = new Map<string, number>();
const MAX_CONCURRENT = 2;

function startActive(accountId: string): boolean {
  const n = active.get(accountId) ?? 0;
  if (n >= MAX_CONCURRENT) return false;
  active.set(accountId, n + 1);
  return true;
}

function endActive(accountId: string) {
  const n = (active.get(accountId) ?? 1) - 1;
  if (n <= 0) active.delete(accountId);
  else active.set(accountId, n);
}

function rateLimit(): number {
  const n = Number(process.env.AGENTS_RATE_LIMIT_PER_HOUR);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
}

/** Records a run and returns true, or returns false when the account is over its hourly limit. */
function takeRun(accountId: string): boolean {
  const now = Date.now();
  const recent = (runs.get(accountId) ?? []).filter((t) => now - t < HOUR_MS);
  if (recent.length >= rateLimit()) {
    runs.set(accountId, recent);
    return false;
  }
  recent.push(now);
  runs.set(accountId, recent);
  return true;
}

/* ------------------------------------------------------------------ handler */

export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  // 1. Session
  const viewer = await getViewer();
  if (!viewer) return fail(401, "unauthorized", "Sign in to use the assistant.");
  const pv = toPolicyViewer(viewer);

  // 2. Known agent
  const { key: rawKey } = await ctx.params;
  const entry = agentEntry(rawKey);
  if (!entry) return fail(404, "not_found", "There is no such assistant task.");
  const key = entry.key;

  // 3. Role
  const role = agentRoleOf(pv.category);
  if (!role || !entry.roles.includes(role)) return fail(403, "forbidden", "This assistant task isn't available in your workspace.");

  // 4. Configuration
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return fail(503, "not_configured", "The assistant needs an API key on the server. Ask the administrator to add ANTHROPIC_API_KEY.");
  }

  // 5. Body size and validation
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > REQUEST_MAX_BYTES) return fail(400, "bad_input", "The request is too large.");
  let text: string;
  try {
    text = await req.text();
  } catch {
    return fail(400, "bad_input", "The request couldn't be read.");
  }
  if (new TextEncoder().encode(text).length > REQUEST_MAX_BYTES) return fail(400, "bad_input", "The request is too large.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail(400, "bad_input", "The request isn't valid JSON.");
  }
  const envelope = agentRunRequestSchema.safeParse(json);
  if (!envelope.success) return fail(400, "bad_input", "Some fields need attention.", { fields: issueMessages(envelope.error) });
  const body = envelope.data;

  const input = AGENT_DEFS[key].inputSchema.safeParse(body.input);
  if (!input.success) {
    const fields = issueMessages(input.error);
    return fail(400, "bad_input", fields[0]?.message ?? "Some fields need attention.", { fields });
  }
  if (body.language !== "en" && !entry.supportsLanguage) return fail(400, "bad_input", "This task writes in English only.");
  if (body.ref && !entry.refTypes.includes(body.ref.type)) return fail(400, "bad_input", "This task can't run on that kind of record.");
  if (entry.refRequired && !body.ref) return fail(400, "bad_input", `Pick a ${entry.refType ?? "record"} first.`);
  if (body.revise && body.revise.previous.kind !== AGENT_DEFS[key].outputKind) return fail(400, "bad_input", "That draft can't be revised by this task.");

  const runReq = {
    ...(body as unknown as AgentRunRequest),
    input: input.data as Record<string, unknown>,
    language: body.language,
    revise: body.revise ? { previous: body.revise.previous as unknown as AgentOutput, instruction: body.revise.instruction } : undefined,
  };

  // 7. Records, through the foundation policy
  let agentCtx;
  try {
    agentCtx = await loadAgentContext(pv, key, runReq);
  } catch (e) {
    if (e instanceof AgentContextError) return fail(e.status, e.code, e.message);
    console.error("[agents] context failed", e);
    return fail(502, "upstream", "Couldn't load the records for this task.");
  }
  if (agentCtx.settings.disabledAgents.includes(key)) return fail(403, "disabled", "This assistant task is switched off in Settings.");

  // 8. Rate limit: spent only once the run is certain to reach the model
  if (!startActive(pv.accountId)) {
    return fail(429, "rate_limited", "You already have assistant tasks running. Wait for one to finish.");
  }
  if (!takeRun(pv.accountId)) {
    endActive(pv.accountId);
    return fail(429, "rate_limited", `You've reached ${rateLimit()} assistant runs this hour. Try again later.`);
  }

  // Stream
  const abort = new AbortController();
  const onClientAbort = () => abort.abort();
  req.signal.addEventListener("abort", onClientAbort, { once: true });
  const encoder = new TextEncoder();
  let ping: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let released = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (!released) {
          released = true;
          endActive(pv.accountId);
        }
        if (ping) clearInterval(ping);
        req.signal.removeEventListener("abort", onClientAbort);
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      };

      send(": connected\n\n");
      ping = setInterval(() => send(": ping\n\n"), PING_MS);

      runAgent({
        key,
        req: runReq,
        viewer: pv,
        ctx: agentCtx,
        emit: (e) => send(encodeAgentEvent(e)),
        signal: abort.signal,
      })
        .catch((e) => {
          if (!abort.signal.aborted) {
            console.error("[agents] run failed", e);
            send(encodeAgentEvent({ type: "error", code: "upstream", message: "The assistant ran into a problem. Try again." }));
          }
        })
        .finally(close);
    },
    cancel() {
      if (!released) {
        released = true;
        endActive(pv.accountId);
      }
      if (ping) clearInterval(ping);
      closed = true;
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
