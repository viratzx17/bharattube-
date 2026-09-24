import * as React from "react";
export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string | { pathname?: string; query?: Record<string, any>; search?: string; hash?: string };
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | null;
  children?: React.ReactNode;
}
declare const Link: React.ForwardRefExoticComponent<LinkProps & React.RefAttributes<HTMLAnchorElement>>;
export default Link;
