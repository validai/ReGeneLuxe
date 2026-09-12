/**
 * Product navigation = Next.js App Router.
 * Vitest rewrites the `@/nav` import to the react-router adapter for MemoryRouter tests.
 */
export {
  Link,
  NavLink,
  useAppNavigate,
  useAppParams,
  useAppSearchParams,
  RUNTIME,
} from "./next.jsx";
