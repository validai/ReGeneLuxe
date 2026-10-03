"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * In-memory navigation for Vitest. Product runtime uses `nav/next` via App Router.
 * This adapter exists so tests do not depend on react-router-dom.
 */

const NavContext = createContext(null);

function parseEntry(entry) {
  const url = new URL(String(entry || "/"), "http://test.local");
  return {
    pathname: url.pathname || "/",
    search: url.search || "",
    hash: url.hash || "",
  };
}

function serialize({ pathname, search, hash }) {
  return `${pathname || "/"}${search || ""}${hash || ""}`;
}

function paramsFromPath(pathname) {
  const campaign = pathname.match(/^\/campaigns\/([^/]+)$/);
  if (campaign) return { campaignId: decodeURIComponent(campaign[1]) };
  const content = pathname.match(/^\/content\/([^/]+)$/);
  if (content && content[1] !== "new") return { contentId: decodeURIComponent(content[1]) };
  return {};
}

function toSearchParams(next, current) {
  if (typeof next === "function") return new URLSearchParams(next(new URLSearchParams(current)));
  if (next instanceof URLSearchParams) return new URLSearchParams(next);
  const params = new URLSearchParams();
  if (next && typeof next === "object") {
    for (const [key, value] of Object.entries(next)) {
      if (value == null || value === "") continue;
      params.set(key, String(value));
    }
  }
  return params;
}

export function MemoryRouter({ initialEntries = ["/"], children }) {
  const [stack, setStack] = useState(() => (initialEntries.length ? initialEntries.map(String) : ["/"]));

  const location = useMemo(() => parseEntry(stack[stack.length - 1]), [stack]);

  const navigate = useCallback((to, options) => {
    if (typeof to === "number") {
      if (to < 0) {
        setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
      }
      return;
    }
    const dest = serialize(parseEntry(to));
    setStack((current) => {
      if (options?.replace) {
        const next = current.slice(0, -1);
        next.push(dest);
        return next;
      }
      return [...current, dest];
    });
  }, []);

  const setSearch = useCallback((next, options) => {
    setStack((current) => {
      const loc = parseEntry(current[current.length - 1]);
      const params = toSearchParams(next, loc.search);
      const qs = params.toString();
      const dest = serialize({
        pathname: loc.pathname,
        search: qs ? `?${qs}` : "",
        hash: loc.hash,
      });
      if (options?.replace) {
        const updated = current.slice(0, -1);
        updated.push(dest);
        return updated;
      }
      return [...current, dest];
    });
  }, []);

  const value = useMemo(
    () => ({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      params: paramsFromPath(location.pathname),
      searchParams: new URLSearchParams(location.search),
      navigate,
      setSearch,
    }),
    [location.hash, location.pathname, location.search, navigate, setSearch],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) {
    throw new Error("MemoryRouter is required for Vitest navigation");
  }
  return ctx;
}

export function Link({ to, href, children, className, onClick, ...rest }) {
  const dest = href || to || "/";
  const { navigate } = useNav();
  return (
    <a
      href={dest}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigate(dest);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export function NavLink({ to, href, children, className, end, title, ...rest }) {
  const dest = href || to || "/";
  const { pathname } = useNav();
  const destPath = parseEntry(dest).pathname;
  const active = end
    ? pathname === destPath
    : pathname === destPath || (destPath !== "/" && pathname.startsWith(destPath));
  const resolvedClass = typeof className === "function" ? className({ isActive: active }) : className;
  return (
    <Link to={dest} className={resolvedClass} title={title} {...rest}>
      {typeof children === "function" ? children({ isActive: active }) : children}
    </Link>
  );
}

export function useAppNavigate() {
  return useNav().navigate;
}

export function useAppParams() {
  return useNav().params;
}

export function useAppSearchParams() {
  const { searchParams, setSearch } = useNav();
  return [searchParams, setSearch];
}

export function useAppPathname() {
  return useNav().pathname;
}

export const RUNTIME = "vite";
