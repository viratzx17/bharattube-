export interface AppRouter {
  push(href: string, opts?: { scroll?: boolean }): void;
  replace(href: string, opts?: { scroll?: boolean }): void;
  back(): void;
  forward(): void;
  refresh(): void;
  prefetch(href: string): void;
}
export function navigate(href: string, opts?: { replace?: boolean; scroll?: boolean }): void;
export function useRouter(): AppRouter;
export function useLocationHref(): string;
export function usePathname(): string;
export function useSearchParams(): URLSearchParams;
export function useParams(): Record<string, string>;
export function redirect(href: string): never;
export function notFound(): never;
