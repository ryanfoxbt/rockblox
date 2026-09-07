"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthFormState, signInAction, signUpAction } from "@/app/auth/actions";
import { NO_PASSWORD_MANAGER_ATTRS } from "@/lib/formAttrs";

// Hand-rolled email/password auth UI — same plain style as ClaimUrlBox /
// SaveCopyButton, rather than pulling in Neon Auth's full prebuilt component
// kit and its own theming layer.
export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next?: string }) {
  const action = mode === "sign-up" ? signUpAction : signInAction;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, {});

  const isSignUp = mode === "sign-up";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6 text-white">
      <Link href="/" title="Home" className="inline-block">
        <h1 className="text-2xl font-black tracking-tight transition hover:text-yellow-400">
          Rock<span className="text-yellow-400">Blocks</span>
        </h1>
      </Link>

      <div className="w-full max-w-sm rounded-lg border border-white/15 bg-white/5 p-6">
        <h2 className="text-lg font-bold">
          {isSignUp ? "Sign up for Super Powers" : "Sign in"}
        </h2>
        <p className="mt-1 text-xs text-white/50">
          {isSignUp
            ? "A free account saves your drum songs privately — as many as you want, with eight beat slots each."
            : "Welcome back. Sign in to get to your saved songs."}
        </p>

        <form action={formAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="next" value={next ?? "/my"} />
          {isSignUp && (
            <label className="flex flex-col gap-1 text-xs text-white/60">
              Name
              <input
                {...NO_PASSWORD_MANAGER_ATTRS}
                name="name"
                required
                maxLength={60}
                className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-base text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none sm:text-sm"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs text-white/60">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-base text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none sm:text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/60">
            Password
            <input
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              minLength={8}
              className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-base text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none sm:text-sm"
            />
          </label>

          {state.error && <p className="text-sm text-red-400">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 w-full rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-xs text-white/40">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <Link href="/auth/sign-in" className="font-semibold text-yellow-400 hover:text-yellow-300">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link href="/auth/sign-up" className="font-semibold text-yellow-400 hover:text-yellow-300">
                Sign up for Super Powers
              </Link>
            </>
          )}
        </p>
      </div>

      <Link href="/" className="text-xs text-white/40 transition hover:text-yellow-400">
        ← Back to RockBlocks
      </Link>
    </div>
  );
}
