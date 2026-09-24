"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";
import { saveSessionToken, getSessionToken } from "@/lib/client";
import { useApp } from "@/context/AppContext";

/**
 * BharatTube OAuth callback.
 *
 * The backend redirects to:
 *   /auth/google/callback?token=<JWT>
 *
 * next.config.ts rewrites that URL to THIS page (keeping the URL unchanged),
 * so direct Vercel navigation can never return a 404.
 *
 * Behaviour (exactly as specified):
 *  1. Read the "token" query parameter.
 *  2. Save it: localStorage.setItem("bharattube_token", token)
 *  3. Navigate to "/".
 *  4. If there is no token, redirect to "/login".
 *
 * The existing API client already reads "bharattube_token" and sends it as
 * `Authorization: Bearer <token>` on /api/v1/* requests, so no client changes
 * are needed.
 */
const TOKEN_KEY = "bharattube_token";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [failed, setFailed] = useState(false);
  const { refreshUser } = useApp();

  useEffect(() => {
    let cancelled = false;
    const liveParams =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    // Backend failure redirect (verified live):
    //   /auth/google/callback?error=google_login_cancelled
    // Never fall back to a stored token here — surface the real error on /login
    // (AppContext turns ?error= into the existing toast).
    const oauthError = searchParams.get("error") || liveParams?.get("error");
    if (oauthError) {
      router.replace(`/login?error=${encodeURIComponent(oauthError)}`);
      return () => {
        cancelled = true;
      };
    }

    // The backend redirects to /auth/google/callback?token=<JWT>. AppContext
    // may already have consumed (and stripped) it from the URL on boot, in
    // which case it is already saved — use that instead of bouncing to login.
    const token =
      searchParams.get("token") ||
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("token")
        : null) ||
      getSessionToken();

    if (!token) {
      // No token -> login
      router.replace("/login");
      return () => {
        cancelled = true;
      };
    }

    // Save exactly as required, deferred out of the effect body so this does
    // not call setState synchronously (avoids a cascading render).
    void Promise.resolve()
      .then(() => {
        // Write to EVERY token store (memory, sessionStorage, localStorage
        // "bharattube_token", cookie). Writing only localStorage let a stale
        // in-memory/sessionStorage token win, so /auth/me got the OLD token → 401.
        saveSessionToken(token);
        localStorage.setItem(TOKEN_KEY, token);
      })
      .then(() => refreshUser()) // GET /auth/me with the NEW token
      .then(() => {
        if (cancelled) return;
        router.replace("/");
      })
      .catch((err) => {
        console.error("Unable to save auth token", err);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, searchParams]);

  if (failed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-sm w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
            Sign-in Failed
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-5">
            We couldn&apos;t save your sign-in. Please try again.
          </p>
          <Link
            href="/login"
            className="inline-block w-full py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-sm text-zinc-500">
      <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
      <span>Signing you in...</span>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-sm text-zinc-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Completing sign-in...
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
