import { LoginForm } from "./LoginForm";
import { BrandMark } from "@/components/ui/BrandMark";

export const metadata = { title: "Sign in · Axoraa Hub" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <main className="min-h-screen p-3 sm:p-4 grid lg:grid-cols-[1.1fr_1fr] gap-3 sm:gap-4">
      {/* Left: brand panel */}
      <section className="card-ink relative overflow-hidden hidden lg:flex flex-col justify-between p-10 min-h-[640px]">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 w-[520px] h-[520px] rounded-full opacity-60"
          style={{ background: "radial-gradient(closest-side, rgba(212,255,50,0.28), transparent)" }}
        />
        <div aria-hidden className="absolute inset-x-10 top-28 bottom-[46%] flex items-end gap-3 opacity-90">
          {[38, 52, 44, 66, 58, 74, 62, 88, 70, 96].map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full origin-bottom animate-grow-y ${i === 9 ? "bg-lime" : "hatch-dark"}`}
              style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>

        <div className="relative flex items-center gap-3">
          <BrandMark className="w-11 h-11" />
          <div>
            <div className="text-[17px] font-medium tracking-tight">Axoraa Hub</div>
            <div className="text-[12px] text-white/50">Operations workspace</div>
          </div>
        </div>

        <div className="relative">
          <h1 className="text-[56px] leading-[0.95] font-medium tracking-[-0.05em] max-w-[520px]">
            Every day of work, <span className="text-lime">in one place.</span>
          </h1>
          <p className="mt-5 text-[15px] text-white/55 max-w-[440px] leading-relaxed">
            Engineering logs, field visits, pipeline and collections — tracked weekly and monthly, backed by your
            Google Sheet.
          </p>
        </div>
      </section>

      {/* Right: form */}
      <section className="card flex flex-col p-6 sm:p-10 min-h-[calc(100vh-2rem)] lg:min-h-0">
        <div className="flex items-center gap-3 lg:hidden">
          <BrandMark className="w-10 h-10" />
          <span className="text-[16px] font-medium tracking-tight">Axoraa Hub</span>
        </div>

        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-[380px] animate-rise">
            <span className="chip">
              <span className="w-1.5 h-1.5 rounded-full bg-good" /> Secure sign-in
            </span>
            <h2 className="mt-5 text-[34px] font-medium tracking-[-0.04em] leading-none">Welcome back</h2>
            <p className="mt-3 text-[14px] text-ink-2">
              Sign in with your Axoraa username. You&apos;ll land on your own dashboard.
            </p>
            <LoginForm next={next ?? ""} />
          </div>
        </div>

        <p className="text-[12px] text-ink-3 text-center">
          Access is limited to Axoraa team accounts. Ask an administrator to reset a password.
        </p>
      </section>
    </main>
  );
}
