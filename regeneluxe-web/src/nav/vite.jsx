"use client";

import {
  Link as RRLink,
  NavLink as RRNavLink,
  useNavigate as useRRNavigate,
  useParams as useRRParams,
  useSearchParams as useRRSearchParams,
} from "react-router-dom";

/** Vite / react-router implementation of shared navigation. */
export function Link({ to, href, children, className, ...rest }) {
  return (
    <RRLink to={href || to || "/"} className={className} {...rest}>
      {children}
    </RRLink>
  );
}

export function NavLink({ to, href, children, className, end, title, ...rest }) {
  return (
    <RRNavLink to={href || to || "/"} className={className} end={end} title={title} {...rest}>
      {children}
    </RRNavLink>
  );
}

export function useAppNavigate() {
  return useRRNavigate();
}

export function useAppParams() {
  return useRRParams();
}

export function useAppSearchParams() {
  return useRRSearchParams();
}

export const RUNTIME = "vite";
