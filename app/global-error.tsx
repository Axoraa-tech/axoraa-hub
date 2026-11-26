"use client";

import { useEffect } from "react";
import { COMPANY_EMAIL, supportMailto } from "@/lib/company";

// Replaces the root layout when it fails, so globals.css, Geist and the theme script are not loaded.
// Everything here is inline: the light palette, system fonts, and a dark variant from the OS setting.
const CSS = `
:root { color-scheme: light dark; }
body { margin: 0; background: #ebebe6; color: #0e0e0f;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
.ge-wrap { min-height: 100dvh; display: grid; place-items: center; padding: 12px; box-sizing: border-box; }
.ge-col { width: 100%; max-width: 520px; }
.ge-brand { display: flex; align-items: center; gap: 12px; margin: 0 4px 16px; font-size: 15px; font-weight: 500; }
.ge-mark { width: 36px; height: 36px; border-radius: 999px; background: #0e0e0f; display: inline-flex; align-items: center; justify-content: center; }
.ge-card { background: #fff; border-radius: 28px; padding: 28px; box-shadow: 0 1px 2px rgba(14,14,15,.04); }
.ge-card h1 { margin: 0; font-size: 26px; line-height: 1.15; font-weight: 500; letter-spacing: -0.03em; }
.ge-card p { margin: 12px 0 0; font-size: 14px; line-height: 1.55; color: #56564f; }
.ge-ref { font-size: 12px !important; color: #7c7c74 !important; }
.ge-ref code { font-family: ui-monospace, monospace; color: #56564f; }
.ge-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
.ge-btn { display: inline-flex; align-items: center; justify-content: center; height: 40px; padding: 0 18px; border-radius: 999px;
  font: 500 13px/1 inherit; font-family: inherit; text-decoration: none; cursor: pointer; border: 0; }
.ge-primary { background: #0e0e0f; color: #fff; }
.ge-ghost { background: #f5f5f1; color: #0e0e0f; box-shadow: inset 0 0 0 1px #e7e7e1; }
.ge-help { margin-top: 24px !important; padding-top: 20px; border-top: 1px solid #e7e7e1; font-size: 13px !important; }
.ge-help a { color: #0e0e0f; font-weight: 500; text-underline-offset: 4px; }
:focus-visible { outline: 2px solid #0e0e0f; outline-offset: 2px; }
@media screen and (prefers-color-scheme: dark) {
  body { background: #0c0c0d; color: #f2f2ee; }
  .ge-mark { background: #000; box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); }
  .ge-card { background: #161617; box-shadow: 0 0 0 1px rgba(255,255,255,.04); }
  .ge-card p, .ge-ref code { color: #b3b3aa; }
  .ge-ref { color: #8a8a82 !important; }
  .ge-primary { background: #d4ff32; color: #0e0e0f; }
  .ge-ghost { background: #1e1e20; color: #f2f2ee; box-shadow: inset 0 0 0 1px rgba(255,255,255,.07); }
  .ge-help { border-top-color: rgba(255,255,255,.07); }
  .ge-help a { color: #f2f2ee; }
  :focus-visible { outline-color: #d4ff32; }
}
`;

function digestOf(error: unknown): string | undefined {
  if (error && typeof error === "object" && "digest" in error) {
    const d = (error as { digest?: unknown }).digest;
    if (typeof d === "string" && d) return d;
  }
  return undefined;
}

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = digestOf(error);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en-IN">
      <body>
        <title>Something went wrong – Axoraa Hub</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <main className="ge-wrap">
          <div className="ge-col">
            <div className="ge-brand">
              <span className="ge-mark" aria-hidden>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path d="M4 19 L12 5 L20 19" stroke="#d4ff32" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="15" r="1.9" fill="#ffffff" />
                </svg>
              </span>
              Axoraa Hub
            </div>
            <section className="ge-card" aria-labelledby="ge-title">
              <h1 id="ge-title">Something went wrong on this page.</h1>
              <p>Records you already saved are safe. Retry first; if it keeps happening, go back to your home page and let us know.</p>
              {digest && (
                <p className="ge-ref">
                  Reference <code>{digest}</code>
                </p>
              )}
              <div className="ge-actions">
                <button type="button" className="ge-btn ge-primary" onClick={() => retry()}>
                  Retry
                </button>
                {/* A full page load: the client router may be the thing that failed. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/" className="ge-btn ge-ghost">
                  Go to your home page
                </a>
              </div>
              <p className="ge-help">
                Still stuck? <a href={supportMailto({ subject: `Hub error ${digest ?? ""}`.trim() })}>Email {COMPANY_EMAIL}</a>
              </p>
            </section>
          </div>
        </main>
      </body>
    </html>
  );
}
