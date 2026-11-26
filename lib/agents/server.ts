import "server-only";

// Runs one agent against the Claude Messages API and reports progress as AgentRunEvents.
// Streaming beta request with server-side fallbacks, adaptive thinking with summarized display,
// explicit effort, a cached system block, structured output for every agent except the web-researched
// brief, pause_turn continuation, a 285 s deadline and typed error mapping.
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaMessageStreamParams,
  BetaToolUnion,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { clientFacingEmail, signature } from "@/lib/company";
import type { PolicyViewer } from "@/lib/data/policy";
import { todayKeyIST } from "@/lib/format";
import { buildUserMessage, STABLE_SYSTEM, type AgentContext } from "./prompts";
import { AGENT_DEFS, type AgentSource } from "./registry";
import type { AgentErrorCode, AgentKey, AgentLanguage, AgentOutput, AgentRunEvent, AgentRunRequest, AgentUsage } from "./types";

export const AGENT_MODEL = "claude-opus-5-5" as const;

const DEADLINE_MS = 285_000;
const MAX_CONTINUATIONS = 3;
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const WEB_TOOLS = [
  { type: "web_search_20260209", name: "web_search", max_uses: 5 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 },
] as BetaToolUnion[];

export interface RunAgentArgs {
  key: AgentKey;
  /** Validated request; input already parsed by the agent's input schema. */
  req: AgentRunRequest & { language: AgentLanguage };
  viewer: PolicyViewer;
  ctx: AgentContext;
  emit: (e: AgentRunEvent) => void;
  signal: AbortSignal;
}

/** Sends thinking text in whole sentences, keeping the unfinished tail for the next delta. */
function sentenceSplitter(emit: (text: string) => void) {
  let buf = "";
  return {
    push(t: string) {
      buf += t;
      const m = /^[\s\S]*[.!?।](?=\s)/.exec(buf);
      if (m && m[0].trim()) {
        emit(m[0].trim());
        buf = buf.slice(m[0].length);
      }
    },
    flush() {
      if (buf.trim()) emit(buf.trim());
      buf = "";
    },
  };
}

function textOf(content: BetaContentBlock[]): string {
  return content
    .filter((b): b is Extract<BetaContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function citationsOf(content: BetaContentBlock[]): AgentSource[] {
  const out: AgentSource[] = [];
  for (const b of content) {
    if (b.type === "text") {
      for (const c of b.citations ?? []) {
        if (c.type === "web_search_result_location") out.push({ title: c.title ?? c.url, url: c.url });
      }
    }
  }
  // Fall back to the search results themselves when the brief cites nothing.
  if (!out.length) {
    for (const b of content) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content) if (r.type === "web_search_result") out.push({ title: r.title, url: r.url });
      }
    }
  }
  return out;
}

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

const ERROR_TEXT: Partial<Record<AgentErrorCode, string>> = {
  refused: "The assistant declined this request. Rephrase it or remove anything unusual from the input.",
  timeout: "The assistant took too long. Try again with less input.",
  rate_limited: "The assistant is busy right now. Try again in a minute.",
  bad_input: "The assistant couldn't accept this request. Shorten the input and try again.",
  upstream: "The assistant ran into a problem. Try again.",
};

export async function runAgent({ key, req, viewer, ctx, emit, signal }: RunAgentArgs): Promise<void> {
  const def = AGENT_DEFS[key];
  const upstream = new AbortController();
  let timedOut = false;
  const onAbort = () => upstream.abort();
  if (signal.aborted) return;
  signal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    upstream.abort();
  }, DEADLINE_MS);

  const fail = (code: AgentErrorCode, message?: string) => emit({ type: "error", code, message: message ?? ERROR_TEXT[code] ?? ERROR_TEXT.upstream! });

  try {
    emit({ type: "status", message: req.revise ? "Reading your revision request" : def.statusMessage });

    const userText = buildUserMessage(key, req.input, ctx, {
      todayIST: todayKeyIST(),
      senderName: viewer.category === "admin" ? ctx.company.name : viewer.name,
      signature: signature(ctx.company, viewer.category === "admin" ? undefined : viewer.name),
      language: req.language,
      revise: req.revise,
    });

    const messages: BetaMessageParam[] = [{ role: "user", content: userText }];
    const base: BetaMessageStreamParams = {
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      model: AGENT_MODEL,
      max_tokens: def.maxTokens,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: def.outputSchema ? { effort: def.effort, format: zodOutputFormat(def.outputSchema) } : { effort: def.effort },
      system: [{ type: "text", text: STABLE_SYSTEM(ctx.company), cache_control: { type: "ephemeral" } }],
      messages,
      ...(def.webSearch ? { tools: WEB_TOOLS } : {}),
    };

    const usage: Required<AgentUsage> = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, webSearches: 0 };
    const allContent: BetaContentBlock[] = [];
    let final: BetaMessage | null = null;
    let wroteStatus = false;

    for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
      const thinking = sentenceSplitter((text) => emit({ type: "thinking", text }));
      const toolInputs = new Map<number, { name: string; json: string; input: unknown }>();
      const stream = getClient().beta.messages.stream({ ...base, messages }, { signal: upstream.signal });

      for await (const ev of stream) {
        if (ev.type === "content_block_start") {
          const b = ev.content_block;
          if (b.type === "server_tool_use") toolInputs.set(ev.index, { name: b.name, json: "", input: b.input });
          else if (b.type === "text" && !wroteStatus) {
            wroteStatus = true;
            emit({ type: "status", message: def.webSearch ? "Writing the brief" : "Writing the draft" });
          }
        } else if (ev.type === "content_block_delta") {
          const d = ev.delta;
          if (d.type === "thinking_delta") thinking.push(d.thinking);
          else if (d.type === "text_delta" && def.outputKind === "brief") emit({ type: "text", text: d.text });
          else if (d.type === "input_json_delta") {
            const t = toolInputs.get(ev.index);
            if (t) t.json += d.partial_json;
          }
        } else if (ev.type === "content_block_stop") {
          thinking.flush();
          const t = toolInputs.get(ev.index);
          if (t) {
            toolInputs.delete(ev.index);
            let input: Record<string, unknown> = {};
            try {
              input = t.json ? (JSON.parse(t.json) as Record<string, unknown>) : ((t.input ?? {}) as Record<string, unknown>);
            } catch {
              input = {};
            }
            if (t.name === "web_search" && typeof input.query === "string" && input.query.trim()) emit({ type: "search", query: input.query.trim() });
            else if (t.name === "web_fetch" && typeof input.url === "string") emit({ type: "status", message: `Reading ${input.url}` });
          }
        }
      }

      const msg = await stream.finalMessage();
      usage.inputTokens += msg.usage.input_tokens ?? 0;
      usage.outputTokens += msg.usage.output_tokens ?? 0;
      usage.cacheReadTokens += msg.usage.cache_read_input_tokens ?? 0;
      usage.webSearches += msg.usage.server_tool_use?.web_search_requests ?? 0;

      // stop_reason first, before any content is read.
      if (msg.stop_reason === "refusal") return fail("refused");
      if (msg.stop_reason === "pause_turn") {
        if (turn === MAX_CONTINUATIONS) return fail("upstream", "The research took too many steps. Try a narrower question.");
        allContent.push(...msg.content);
        // Re-send with the assistant's blocks appended unchanged (server_tool_use, results and thinking included).
        messages.push({ role: "assistant", content: msg.content as unknown as BetaContentBlockParam[] });
        emit({ type: "status", message: "Still researching" });
        continue;
      }
      if (msg.stop_reason === "max_tokens") return fail("upstream", "The draft came out too long and was cut off. Ask for something shorter.");
      allContent.push(...msg.content);
      final = msg;
      break;
    }
    if (!final) return fail("upstream");

    let output: AgentOutput;
    if (def.outputSchema) {
      const raw = textOf(final.content);
      let parsed: unknown;
      try {
        parsed = def.outputSchema.parse(JSON.parse(stripFences(raw)));
      } catch {
        return fail("upstream", "The assistant's answer couldn't be read. Try again.");
      }
      output = def.toOutput(parsed, []);
    } else {
      output = def.toOutput(textOf(allContent), citationsOf(allContent));
      if (output.kind === "brief" && !output.markdown) return fail("upstream", "The assistant didn't find enough to write a brief. Check the company name and website.");
    }

    // Emails copy the shared inbox; the browser fills in the recipient.
    const cc = clientFacingEmail(ctx.company);
    if (output.kind === "message" && output.email) output.email = { ...output.email, cc };
    if (output.kind === "visit_notes" && output.recapEmail) output.recapEmail = { ...output.recapEmail, cc };
    // Only deals the run was given.
    if (output.kind === "pipeline_review") {
      const known = new Set((ctx.deals ?? []).map((d) => d.id));
      const seen = new Set<string>();
      output.deals = output.deals.filter((d) => known.has(d.dealId) && !seen.has(d.dealId) && !!seen.add(d.dealId));
    }

    emit({ type: "result", output, model: final.model, usage });
  } catch (e) {
    if (e instanceof Anthropic.APIUserAbortError || upstream.signal.aborted) {
      if (timedOut) fail("timeout");
      // Client disconnected: nothing to report and nothing to log.
      return;
    }
    if (e instanceof Anthropic.RateLimitError) return fail("rate_limited");
    if (e instanceof Anthropic.AuthenticationError) return fail("not_configured", "The ANTHROPIC_API_KEY on the server was rejected.");
    if (e instanceof Anthropic.BadRequestError) return fail("bad_input");
    if (e instanceof Anthropic.APIError) {
      console.error(`[agents] ${key} upstream error`, e.status, e.message);
      return fail("upstream");
    }
    console.error(`[agents] ${key} failed`, e);
    return fail("upstream");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}
