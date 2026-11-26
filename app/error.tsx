"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, RotateCcw, TriangleAlert } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { COMPANY_EMAIL, supportMailto } from "@/lib/company";

function digestOf(error: unknown): string | undefined {
  if (error && typeof error === "object" && "digest" in error) {
    const d = (error as { digest?: unknown }).digest;
    if (typeof d === "string" && d) return d;
  }
  return undefined;
}

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = digestOf(error);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center p-3 sm:p-4">
      <div className="w-full max-w-[520px] animate-rise">
        <div className="mb-4 flex items-center gap-3 px-1">
          <BrandMark className="h-9 w-9" />
          <span className="text-[15px] font-medium tracking-tight">Axoraa Hub</span>
        </div>

        <section className="card p-6 sm:p-8" aria-labelledby="error-title">
          <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-coral-soft text-negative">
            <TriangleAlert className="h-5 w-5" />
          </span>
          <h1 id="error-title" className="mt-5 text-[26px] font-medium leading-tight tracking-[-0.035em] sm:text-[30px]">
            Something went wrong on this page.
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
            Records you already saved are safe. Retry first; if it keeps happening, go back to your home page and let us
            know.
          </p>
          {digest && (
            <p className="mt-4 text-[12px] text-ink-3">
              Reference <span className="font-mono text-ink-2">{digest}</span>
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => retry()} className="btn btn-ink">
              <RotateCcw aria-hidden className="h-4 w-4" />
              Retry
            </button>
            <Link href="/" className="btn btn-ghost">
              <ArrowLeft aria-hidden className="h-4 w-4" />
              Go to your home page
            </Link>
          </div>

          <p className="mt-6 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-line pt-5 text-[13px] text-ink-2">
            <Mail aria-hidden className="h-3.5 w-3.5 text-ink-3" />
            Still stuck?
            <a
              href={supportMailto({ subject: `Hub error ${digest ?? ""}`.trim() })}
              className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              Email {COMPANY_EMAIL}
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
