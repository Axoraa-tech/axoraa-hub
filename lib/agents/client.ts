// Browser side of POST /api/agents/[key]: posts the request and turns the SSE stream into AgentRunEvents.
// A non-2xx JSON answer becomes one 'error' event. Comment lines (': ping') are ignored.
import type { AgentErrorCode, AgentKey, AgentRunEvent, AgentRunRequest } from "./types";

const CODES: readonly AgentErrorCode[] = [
  "not_configured",
  "unauthorized",
  "forbidden",
  "disabled",
  "bad_input",
  "not_found",
  "rate_limited",
  "refused",
  "timeout",
  "upstream",
];

function codeForStatus(status: number): AgentErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 400 || status === 413) return "bad_input";
  if (status === 429) return "rate_limited";
  if (status === 503) return "not_configured";
  return "upstream";
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException ? e.name === "AbortError" : (e as { name?: string })?.name === "AbortError";
}

export async function runAgentStream(
  key: AgentKey,
  body: AgentRunRequest,
  { signal, onEvent }: { signal?: AbortSignal; onEvent: (e: AgentRunEvent) => void }
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/agents/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  } catch (e) {
    if (isAbort(e)) return;
    onEvent({ type: "error", code: "upstream", message: "Couldn't reach the server. Check your connection and try again." });
    return;
  }

  if (!res.ok || !res.body) {
    let code = codeForStatus(res.status);
    let message = "The assistant couldn't start. Try again.";
    try {
      const j = (await res.json()) as { error?: string; message?: string };
      if (j.error && (CODES as readonly string[]).includes(j.error)) code = j.error as AgentErrorCode;
      if (typeof j.message === "string" && j.message) message = j.message;
    } catch {
      // not JSON (for example a proxy page)
    }
    onEvent({ type: "error", code, message });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  let finished = false;

  const dispatch = () => {
    if (!data.length) return;
    const payload = data.join("\n");
    data = [];
    try {
      const ev = JSON.parse(payload) as AgentRunEvent;
      if (ev && typeof ev.type === "string") {
        if (ev.type === "result" || ev.type === "error") finished = true;
        onEvent(ev);
      }
    } catch {
      // ignore a malformed event
    }
  };

  const handleLine = (line: string) => {
    if (line === "") return dispatch();
    if (line.startsWith(":")) return;
    if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, "");
        buffer = buffer.slice(nl + 1);
        handleLine(line);
      }
    }
    buffer += decoder.decode();
    if (buffer) handleLine(buffer.replace(/\r$/, ""));
    dispatch();
  } catch (e) {
    if (isAbort(e) || signal?.aborted) return;
    if (!finished) onEvent({ type: "error", code: "upstream", message: "The connection dropped before the assistant finished. Try again." });
    return;
  }
  if (!finished && !signal?.aborted) {
    onEvent({ type: "error", code: "upstream", message: "The connection closed before the assistant finished. Try again." });
  }
}
