import { Link } from "@/nav";
import ErrorState from "../components/app/ErrorState.jsx";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <ErrorState
        title="This route does not exist."
        body="The page you opened is not part of ReGeneLuxe."
        action={(
          <Link to="/" className="rl-btn">
            Back to dashboard
          </Link>
        )}
      />
    </div>
  );
}
