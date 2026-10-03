/**
 * Product navigation = Next.js App Router.
 * Vitest rewrites the `@/nav` import to the in-memory adapter for MemoryRouter tests.
 */
export {
  Link,
  NavLink,
  useAppNavigate,
  useAppParams,
  useAppPathname,
  useAppSearchParams,
  RUNTIME,
} from "./next.jsx";
