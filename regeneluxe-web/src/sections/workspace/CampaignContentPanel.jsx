import { Link } from "@/nav";
import StatusBadge from "../../components/app/StatusBadge.jsx";
import EmptyState from "../../components/app/EmptyState.jsx";
import { CONTENT_STATUS_LABELS } from "../../data/domain.js";

export default function CampaignContentPanel({ campaign, content }) {
  const items = content.filter((item) => item.campaignId === campaign.id);
  if (!items.length) {
    return <EmptyState title="No campaign content" body="Compose a post or build a plan from strategy." action={<Link to={`/content/new`} className="rl-btn">Compose</Link>} />;
  }
  return (
    <ul className="divide-y divide-rl_border rounded-2xl border border-rl_border bg-rl_surface">
      {items.map((item) => (
        <li key={item.id}>
          <Link to={`/content/${item.id}`} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm">{item.title || "Untitled"}</span>
            <StatusBadge label={CONTENT_STATUS_LABELS[item.status] || item.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
