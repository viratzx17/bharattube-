import { useMemo, useSyncExternalStore } from "react";

/**
 * Minimal client-side implementation of `next/navigation` backed by the
 * browser History API (same URLs as the original Next.js app).
 */

const NAV_EVENT = "__next_compat_navigate__";
const listeners = new Set();

function notify() {
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", notify);
  window.addEventListener(NAV_EVENT, notify);
}

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getHref() {
  return window.location.pathname + window.location.search + window.location.hash;
}

function isExternal(url) {
  try {
    const u = new URL(url, window.location.href);
    return u.origin !== window.location.origin;
  } catch {
    return false;
  }
}

export function navigate(href, { replace = false, scroll = true } = {}) {
  const target = String(href);
  if (isExternal(target)) {
    if (replace) window.location.replace(target);
    else window.location.assign(target);
    return;
  }
  const url = new URL(target, window.location.href);
  const next = url.pathname + url.search + url.hash;
  if (replace) window.history.replaceState({}, "", next);
  else window.history.pushState({}, "", next);
  notify();
  if (scroll) {
    if (url.hash) {
      const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }
}

const router = {
  push: (href, opts) => navigate(href, { replace: false, scroll: opts?.scroll !== false }),
  replace: (href, opts) => navigate(href, { replace: true, scroll: opts?.scroll !== false }),
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  refresh: () => notify(),
  prefetch: () => {},
};

export function useRouter() {
  return router;
}

export function useLocationHref() {
  return useSyncExternalStore(subscribe, getHref, () => "/");
}

export function usePathname() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => "/"
  );
}

export function useSearchParams() {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => ""
  );
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useParams() {
  return {};
}

export function redirect(href) {
  navigate(href, { replace: true });
}

export function notFound() {
  throw new Error("NEXT_NOT_FOUND");
}
