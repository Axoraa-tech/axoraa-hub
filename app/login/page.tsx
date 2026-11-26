import type { Metadata } from "next";
import { BrandMark } from "@/components/ui/BrandMark";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

// Decorative pill columns in the style of the Command Center chart: hatched weeks, the current one in lime.
const BARS = [38, 52, 44, 66, 58, 74, 62, 88, 70, 96];
const MOBILE_BARS = [40, 58, 48, 70, 62, 84, 100];
const AREAS = ["Work logs", "Deals and visits", "Clients and invoices", "Content and campaigns"];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <main className="grid min-h-dvh gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[1.1fr_1fr]">
      {/* Left: brand panel (desktop) */}
      <section aria-hidden className="card-ink relative hidden min-h-[640px] flex-col justify-between overflow-hidden p-10 lg:flex">
        <div className="relative flex items-center gap-3">
          <BrandMark className="h-11 w-11" />
          <div>
            <div className="text-[17px] font-medium tracking-tight">Axoraa Hub</div>
            <div className="text-[12px] text-white/50">Operations workspace</div>
          </div>
        </div>

        <div className="relative mt-10 flex-1">
          <div className="absolute inset-x-0 bottom-6 top-10 flex items-end gap-3">
            {BARS.map((h, i) => {
              const last = i === BARS.length - 1;
              return (
                <div key={i} className="relative flex h-full flex-1 items-end">
                  {last && (
                    <span
                      className="absolute left-1/2 z-10 -translate-x-1/2 animate-rise whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-ink-panel shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)]"
                      style={{ bottom: `calc(${h}% + 10px)`, animationDelay: "700ms" }}
                    >
                      This week
                    </span>
                  )}
                  <div
                    className={`w-full origin-bottom animate-grow-y rounded-full ${last ? "bg-lime" : "hatch-dark"}`}
                    style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="absolute inset-x-0 bottom-0 border-t border-dashed border-white/12" />
        </div>

        <div className="relative mt-10">
          <p className="max-w-[520px] text-[56px] font-medium leading-[0.95] tracking-[-0.05em]">
            Every day of work, <span className="text-lime">in one place.</span>
          </p>
          <p className="mt-5 max-w-[440px] text-[15px] leading-relaxed text-white/60">
            Engineering logs, field visits, pipeline and collections, tracked weekly and monthly and shared through the
            team&apos;s Google Sheet.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <li key={a} className="rounded-full bg-white/8 px-3 py-1.5 text-[12px] text-white/70 ring-1 ring-white/10">
                {a}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Right: form */}
      <section className="flex min-w-0 flex-col gap-3 sm:gap-4">
        {/* Compact brand card (phones and tablets) */}
        <div aria-hidden className="card-ink flex items-center justify-between gap-4 overflow-hidden p-5 lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div className="min-w-0">
              <div className="truncate text-[16px] font-medium tracking-tight">Axoraa Hub</div>
              <div className="truncate text-[12px] text-white/50">Operations workspace</div>
            </div>
          </div>
          <div className="flex h-12 shrink-0 items-end gap-1.5">
            {MOBILE_BARS.map((h, i) => (
              <div
                key={i}
                className={`w-2.5 origin-bottom animate-grow-y rounded-full ${i === MOBILE_BARS.length - 1 ? "bg-lime" : "hatch-dark"}`}
                style={{ height: `${h}%`, animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        </div>

        <div className="card flex flex-1 flex-col p-6 sm:p-10">
          <div className="flex flex-1 items-center justify-center py-6 sm:py-10">
            <div className="w-full max-w-[380px] animate-rise">
              <span className="chip">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-good" /> Axoraa team accounts
              </span>
              <h1 className="mt-5 text-[30px] font-medium leading-none tracking-[-0.04em] sm:text-[34px]">Welcome back</h1>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
                Sign in with your Axoraa username. You&apos;ll land on your own dashboard.
              </p>
              <LoginForm next={next ?? ""} />
            </div>
          </div>

          <footer className="flex flex-col items-center gap-1 text-center text-[12px] text-ink-3">
            <p>Access is limited to Axoraa team accounts. The administrator resets passwords.</p>
            <p>Axoraa, Karnataka</p>
          </footer>
        </div>
      </section>
    </main>
  );
}
