"use client";

import NextLink from "next/link";
import { usePathname, useRouter, useParams, useSearchParams as useNextSearchParams } from "next/navigation";
import { useMemo } from "react";

/** Next.js App Router implementation of shared navigation. */
export function Link({ to, href, children, className, ...rest }) {
  const dest = href || to || "/";
  return (
    <NextLink href={dest} className={className} {...rest}>
      {children}
    </NextLink>
  );
}

export function NavLink({ to, href, children, className, end, title, ...rest }) {
  const pathname = usePathname();
  const dest = href || to || "/";
  const active = end ? pathname === dest : pathname === dest || (dest !== "/" && pathname.startsWith(dest));
  const resolvedClass = typeof className === "function" ? className({ isActive: active }) : className;
  return (
    <NextLink href={dest} className={resolvedClass} title={title} {...rest}>
      {typeof children === "function" ? children({ isActive: active }) : children}
    </NextLink>
  );
}

export function useAppNavigate() {
  const router = useRouter();
  return (to, options) => {
    if (typeof to === "number") {
      if (to < 0) router.back();
      return;
    }
    const replace = options?.replace;
    if (replace) router.replace(to);
    else router.push(to);
  };
}

export function useAppParams() {
  return useParams();
}

export function useAppSearchParams() {
  const params = useNextSearchParams();
  return useMemo(() => {
    const setParams = (next, opts) => {
      const url = new URLSearchParams(typeof next === "function" ? next(params) : next);
      const qs = url.toString();
      const path = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      if (opts?.replace) window.history.replaceState(null, "", path);
      else window.history.pushState(null, "", path);
    };
    return [params, setParams];
  }, [params]);
}

export const RUNTIME = "next";
