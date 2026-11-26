import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { COMPANY_EMAIL, supportMailto } from "@/lib/company";

export const metadata: Metadata = { title: "Page not found" };

// Ghost pills with one dashed slot: the original chart language, with the missing day left empty.
const PILLS = [46, 64, 52, 0, 58];

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-3 sm:p-4">
      <div className="w-full max-w-[520px] animate-rise">
        <div className="mb-4 flex items-center gap-3 px-1">
          <BrandMark className="h-9 w-9" />
          <span className="text-[15px] font-medium tracking-tight">Axoraa Hub</span>
        </div>

        <section className="card p-6 sm:p-8" aria-labelledby="nf-title">
          <div className="flex items-end justify-between gap-4">
            <span className="num text-[64px] text-ink-3 sm:text-[80px]">404</span>
            <div aria-hidden className="flex h-16 items-end gap-1.5 sm:h-20">
              {PILLS.map((h, i) =>
                h ? (
                  <div key={i} className="hatch w-3 rounded-full sm:w-3.5" style={{ height: `${h}%` }} />
                ) : (
                  <div key={i} className="dashed-slot h-full w-3 rounded-full sm:w-3.5" />
                )
              )}
            </div>
          </div>
          <h1 id="nf-title" className="mt-6 text-[26px] font-medium leading-tight tracking-[-0.035em] sm:text-[30px]">
            Page not found
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
            The link may be old, or the page has moved. Your home page has everything you can open.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link href="/" className="btn btn-ink">
              <ArrowLeft aria-hidden className="h-4 w-4" />
              Go to your home page
            </Link>
          </div>

          <p className="mt-6 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-line pt-5 text-[13px] text-ink-2">
            <Mail aria-hidden className="h-3.5 w-3.5 text-ink-3" />
            Expected something here?
            <a
              href={supportMailto({ subject: "Hub page not found" })}
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
