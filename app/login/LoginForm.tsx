"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="eyebrow block mb-2">Username</span>
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.username}
          placeholder="e.g. akshar"
          className="field"
          required
        />
      </label>
      <label className="block">
        <span className="eyebrow block mb-2">Password</span>
        <div className="relative">
          <input
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="field pr-12"
            required
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-ink-3 hover:text-ink hover:bg-surface-3"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </label>

      <div aria-live="polite" className="min-h-5">
        {state.error && <p className="text-[13px] text-coral">{state.error}</p>}
      </div>

      <button type="submit" disabled={pending} className="btn btn-ink w-full h-12 text-[14px] group">
        {pending ? (
          <LoaderCircle className="w-4 h-4 animate-spin" />
        ) : (
          <>
            Sign in
            <span className="w-7 h-7 -mr-2 ml-auto rounded-full bg-lime text-ink flex items-center justify-center transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </>
        )}
      </button>
    </form>
  );
}
