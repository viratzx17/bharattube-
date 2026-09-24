import { Component, Suspense, type ComponentType, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import "./app/globals.css";
import { AppProvider } from "@/context/AppContext";
import { AppShell } from "@/components/Navigation";
import { GlobalModals } from "@/components/Modals";
import RouteError from "@/app/error";

/* ------------------------------------------------------------------ */
/* File-based routes (mirrors src/app/** from the original Next app)    */
/* ------------------------------------------------------------------ */
import HomePage from "@/app/page";
import AuthCallbackPage from "@/app/auth/callback/page";
import AuthGoogleCallbackPage from "@/app/auth/google/callback/page";
import AuthGooglePage from "@/app/auth/google/page";
import AuthLoginPage from "@/app/auth/login/page";
import AuthRegisterPage from "@/app/auth/register/page";
import AuthSignupPage from "@/app/auth/signup/page";
import CallbackPage from "@/app/callback/page";
import ChannelPage from "@/app/channel/[id]/page";
import EditChannelPage from "@/app/edit-channel/page";
import EditProfilePage from "@/app/edit-profile/page";
import ForgotPasswordPage from "@/app/forgot-password/page";
import HistoryPage from "@/app/history/page";
import LikedPage from "@/app/liked/page";
import LoginPage from "@/app/login/page";
import MyVideosPage from "@/app/my-videos/page";
import PlaylistsPage from "@/app/playlists/page";
import RegisterPage from "@/app/register/page";
import ResetPasswordPage from "@/app/reset-password/page";
import SearchPage from "@/app/search/page";
import SettingsPage from "@/app/settings/page";
import ShortsPage from "@/app/shorts/page";
import SignupPage from "@/app/signup/page";
import SubscriptionsPage from "@/app/subscriptions/page";
import VerifyEmailPage from "@/app/verify-email/page";
import WatchLaterPage from "@/app/watch-later/page";
import WatchPage from "@/app/watch/[id]/page";
import YouPage from "@/app/you/page";

const staticRoutes: Record<string, ComponentType<any>> = {
  "/": HomePage,
  "/auth/callback": AuthCallbackPage,
  "/auth/google/callback": AuthGoogleCallbackPage,
  "/auth/google": AuthGooglePage,
  "/auth/login": AuthLoginPage,
  "/auth/register": AuthRegisterPage,
  "/auth/signup": AuthSignupPage,
  "/callback": CallbackPage,
  "/edit-channel": EditChannelPage,
  "/edit-profile": EditProfilePage,
  "/forgot-password": ForgotPasswordPage,
  "/history": HistoryPage,
  "/liked": LikedPage,
  "/login": LoginPage,
  "/my-videos": MyVideosPage,
  "/playlists": PlaylistsPage,
  "/register": RegisterPage,
  "/reset-password": ResetPasswordPage,
  "/search": SearchPage,
  "/settings": SettingsPage,
  "/shorts": ShortsPage,
  "/signup": SignupPage,
  "/subscriptions": SubscriptionsPage,
  "/verify-email": VerifyEmailPage,
  "/watch-later": WatchLaterPage,
  "/you": YouPage,
};

const dynamicRoutes: { prefix: string; component: ComponentType<any> }[] = [
  { prefix: "/channel/", component: ChannelPage },
  { prefix: "/watch/", component: WatchPage },
];

/**
 * Next.js passes dynamic `params` as a Promise that pages unwrap with
 * React.use(). Cache one already-fulfilled promise per value so use() never
 * suspends in a loop.
 */
const paramsCache = new Map<string, Promise<{ id: string }>>();
function paramsFor(id: string): Promise<{ id: string }> {
  let p = paramsCache.get(id);
  if (!p) {
    const value = { id };
    p = Promise.resolve(value);
    Object.assign(p, { status: "fulfilled", value });
    paramsCache.set(id, p);
  }
  return p;
}

function normalize(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.replace(/\/+$/, "");
  return pathname || "/";
}

function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex items-center gap-5">
        <h1 className="text-2xl font-medium pr-5 border-r border-zinc-300 dark:border-zinc-700">404</h1>
        <h2 className="text-sm">This page could not be found.</h2>
      </div>
    </div>
  );
}

function resolveRoute(pathname: string): ReactNode {
  const path = normalize(pathname);
  const Static = staticRoutes[path];
  if (Static) return <Static />;

  for (const { prefix, component: Dynamic } of dynamicRoutes) {
    if (path.startsWith(prefix)) {
      const rest = path.slice(prefix.length);
      if (rest && !rest.includes("/")) {
        return <Dynamic params={paramsFor(decodeURIComponent(rest))} />;
      }
    }
  }
  return <NotFound />;
}

/* Route-level error boundary → renders src/app/error.tsx */
class RouteErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { error: (Error & { digest?: string }) | null }
> {
  state: { error: (Error & { digest?: string }) | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return <RouteError error={this.state.error} reset={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function Router() {
  const pathname = usePathname();
  return (
    <RouteErrorBoundary resetKey={pathname}>
      <Suspense fallback={null}>
        <div key={normalize(pathname)} className="contents">
          {resolveRoute(pathname)}
        </div>
      </Suspense>
    </RouteErrorBoundary>
  );
}

/* Mirrors RootLayout from src/app/layout.tsx (html/body live in index.html) */
export default function App() {
  return (
    <AppProvider>
      <AppShell>
        <Router />
      </AppShell>
      <GlobalModals />
    </AppProvider>
  );
}
