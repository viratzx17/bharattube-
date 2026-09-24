import { createElement, forwardRef } from "react";
import { navigate } from "./navigation.js";

function resolveHref(href) {
  if (typeof href === "string") return href;
  if (href && typeof href === "object") {
    let out = href.pathname || "";
    if (href.query) {
      const qs = new URLSearchParams(href.query).toString();
      if (qs) out += "?" + qs;
    } else if (href.search) {
      out += href.search;
    }
    if (href.hash) out += href.hash.startsWith("#") ? href.hash : "#" + href.hash;
    return out || "/";
  }
  return "/";
}

const Link = forwardRef(function Link(props, ref) {
  const {
    href,
    as: _as,
    replace,
    scroll,
    prefetch: _prefetch,
    shallow: _shallow,
    passHref: _passHref,
    legacyBehavior: _legacy,
    locale: _locale,
    onClick,
    target,
    children,
    ...rest
  } = props;

  const url = resolveHref(href);

  const handleClick = (e) => {
    if (onClick) onClick(e);
    if (e.defaultPrevented) return;
    if (
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      (target && target !== "_self") ||
      rest.download !== undefined
    ) {
      return;
    }
    let external = false;
    try {
      external = new URL(url, window.location.href).origin !== window.location.origin;
    } catch {
      external = false;
    }
    if (external) return;
    e.preventDefault();
    navigate(url, { replace: !!replace, scroll: scroll !== false });
  };

  return createElement(
    "a",
    { ...rest, ref, href: url, target, onClick: handleClick },
    children
  );
});

export default Link;
