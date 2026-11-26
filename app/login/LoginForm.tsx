"use client";

import { useActionState, useState } from "react";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { COMPANY_EMAIL, supportMailto } from "@/lib/company";
import { login, type LoginState } from "./actions";

// The server action, its field names ('username', 'password', 'next') and its throttle message
// live in ./actions.ts and are unchanged. This file only draws the form around them.
const THROTTLE_PREFIX = "Too many attempts";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);

  const error = state.error;
  const throttled = !!error && error.startsWith(THROTTLE_PREFIX);
  const who = (typed ?? state.username ?? "").trim();
  const helpHref = supportMailto({ subject: `Hub access – ${who || "unknown user"}` });

  return (
    <>
      <form action={action} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next} />

        <div>
          <label htmlFor="login-username" className="mb-2 block text-[12px] font-medium text-ink-2">
            Username
          </label>
          <input
            id="login-username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={state.username}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="e.g. akshar"
            className="field h-12"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
            required
          />
        </div>

        <div>
          <label htmlFor="login-password" className="mb-2 block text-[12px] font-medium text-ink-2">
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              className="field h-12 pr-20"
              aria-describedby={error ? "login-error" : undefined}
              required
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-pressed={show}
              aria-controls="login-password"
              className="absolute right-2 top-1/2 h-8 -translate-y-1/2 rounded-full px-3 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div className="min-h-5">
          {error && (
            <p id="login-error" role="alert" className="flex items-start gap-2 text-[13px] text-negative">
              <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
              <span>{error}</span>
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="btn btn-ink group h-12 w-full text-[14px]"
        >
          {pending ? (
            <>
              <LoaderCircle aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <span
                aria-hidden
                className="-mr-2 ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-lime text-on-lime transition-transform duration-200 group-hover:translate-x-0.5"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-[13px] text-ink-2">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <Mail aria-hidden className="h-3.5 w-3.5 text-ink-3" />
          <span>Trouble signing in?</span>
          <a href={helpHref} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Email {COMPANY_EMAIL}
          </a>
        </p>
        {throttled && (
          <p className="card-inset px-4 py-3 text-[13px] text-ink">
            Locked out?{" "}
            <a href={helpHref} className="font-medium underline underline-offset-4">
              Email {COMPANY_EMAIL}
            </a>{" "}
            and we&apos;ll reset it.
          </p>
        )}
      </div>
    </>
  );
}
