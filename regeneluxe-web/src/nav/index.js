/**
 * Default shared navigation = Vite/react-router.
 * Next App Router peel can switch this file to re-export ./next.jsx
 * once ClientSpa no longer wraps BrowserRouter.
 */
export {
  Link,
  NavLink,
  useAppNavigate,
  useAppParams,
  useAppSearchParams,
  RUNTIME,
} from "./vite.jsx";
