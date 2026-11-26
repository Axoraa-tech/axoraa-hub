import React from "react";

/*
 * A small Markdown renderer for assistant briefs. It builds React elements directly (no HTML strings,
 * no dangerouslySetInnerHTML): headings, bullet and numbered lists, paragraphs, bold, italics, inline
 * code and links. Links are kept only for http(s) URLs and open in a new tab with rel noopener.
 */

type Block =
  | { kind: "h"; level: 1 | 2 | 3; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "p"; text: string }
  | { kind: "hr" };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ kind: "h", level: Math.min(3, h[1].length) as 1 | 2 | 3, text: h[2].replace(/\s*#+$/, "") });
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flushPara();
      flushList();
      blocks.push({ kind: "hr" });
      continue;
    }
    const ul = /^[-*+•]\s+(.*)$/.exec(t);
    const ol = /^\d+[.)]\s+(.*)$/.exec(t);
    if (ul || ol) {
      flushPara();
      const kind = ul ? "ul" : "ol";
      if (!list || list.kind !== kind) {
        flushList();
        list = { kind, items: [] };
      }
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    // A continuation line of a list item (indented text).
    if (list && /^\s{2,}/.test(raw)) {
      list.items[list.items.length - 1] += ` ${t}`;
      continue;
    }
    flushList();
    para.push(t);
  }
  flushPara();
  flushList();
  return blocks;
}

function safeHref(url: string): string | null {
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// Order matters: links, then code, then bold, then italics, then bare URLs.
const INLINE = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|(https?:\/\/[^\s)]+)/g;

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const k = `${keyBase}-${i++}`;
    if (m[1] !== undefined) {
      const href = safeHref(m[2]);
      out.push(
        href ? (
          <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline decoration-ink-3/50 underline-offset-2 hover:decoration-ink">
            {inline(m[1], k)}
          </a>
        ) : (
          <span key={k}>{m[1]}</span>
        )
      );
    } else if (m[3] !== undefined) {
      out.push(
        <code key={k} className="rounded-md bg-surface-2 px-1 py-0.5 font-mono text-[0.92em]">
          {m[3]}
        </code>
      );
    } else if (m[4] !== undefined || m[5] !== undefined) {
      out.push(
        <strong key={k} className="font-medium text-ink">
          {inline(m[4] ?? m[5], k)}
        </strong>
      );
    } else if (m[6] !== undefined) {
      out.push(<em key={k}>{inline(m[6], k)}</em>);
    } else if (m[7] !== undefined) {
      const href = safeHref(m[7]);
      out.push(
        href ? (
          <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="break-all underline decoration-ink-3/50 underline-offset-2 hover:decoration-ink">
            {m[7]}
          </a>
        ) : (
          m[7]
        )
      );
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className={`space-y-3 text-[14px] leading-[1.6] text-ink-2 ${className}`}>
      {blocks.map((b, bi) => {
        const k = `b${bi}`;
        switch (b.kind) {
          case "h":
            return b.level === 1 ? (
              <h3 key={k} className="pt-1 text-[19px] font-medium leading-tight tracking-[-0.02em] text-ink">
                {inline(b.text, k)}
              </h3>
            ) : (
              <h4 key={k} className={`pt-2 font-medium leading-tight tracking-[-0.01em] text-ink ${b.level === 2 ? "text-[16px]" : "text-[14.5px]"}`}>
                {inline(b.text, k)}
              </h4>
            );
          case "ul":
            return (
              <ul key={k} className="space-y-1.5 pl-1">
                {b.items.map((it, ii) => (
                  <li key={ii} className="flex gap-2.5">
                    <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ink-3" />
                    <span className="min-w-0">{inline(it, `${k}-${ii}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={k} className="space-y-1.5 pl-1">
                {b.items.map((it, ii) => (
                  <li key={ii} className="flex gap-2.5">
                    <span aria-hidden className="w-5 shrink-0 text-right tabular-nums text-ink-3">
                      {ii + 1}.
                    </span>
                    <span className="min-w-0">{inline(it, `${k}-${ii}`)}</span>
                  </li>
                ))}
              </ol>
            );
          case "hr":
            return <hr key={k} className="border-line" />;
          default:
            return <p key={k}>{inline(b.text, k)}</p>;
        }
      })}
    </div>
  );
}
