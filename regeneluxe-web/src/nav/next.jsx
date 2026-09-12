"use client";

import NextLink from "next/link";
import { usePathname, useRouter, useParams, useSearchParams as useNextSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

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
  return useCallback((to, options) => {
    if (typeof to === "number") {
      if (to < 0) router.back();
      return;
    }
    if (options?.replace) router.replace(to);
    else router.push(to);
  }, [router]);
}

export function useAppParams() {
  return useParams();
}

export function useAppSearchParams() {
  const params = useNextSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const setParams = useCallback((next, opts) => {
    const current = new URLSearchParams(params.toString());
    const url = new URLSearchParams(typeof next === "function" ? next(current) : next);
    const qs = url.toString();
    const path = `${pathname}${qs ? `?${qs}` : ""}`;
    if (opts?.replace) router.replace(path);
    else router.push(path);
  }, [params, pathname, router]);

  return useMemo(() => [params, setParams], [params, setParams]);
}

export const RUNTIME = "next";
