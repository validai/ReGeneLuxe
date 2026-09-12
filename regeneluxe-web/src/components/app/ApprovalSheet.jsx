import { Link } from "@/nav";
import SideSheet from "./SideSheet.jsx";
import { saveContent } from "../../data/collectionRepository.js";
import { scheduleContent } from "../../data/publishing.js";
import { formatStamp } from "../../utils/dates.js";

function defaultScheduleAt(content) {
  if (content?.scheduledAt) return content.scheduledAt;
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

export default function ApprovalSheet({
  open,
  content,
  accounts = [],
  onClose,
  onApproved,
  onRejected,
}) {
  if (!content) return null;

  const linked = accounts.filter((account) => (content.accountIds || []).includes(account.id));
  const caption = content.caption || content.variants?.[0]?.caption || "";
  const scheduleAt = defaultScheduleAt(content);

  const approve = () => {
    const next = scheduleContent(content, scheduleAt);
    onApproved?.(next);
    onClose?.();
  };

  const reject = () => {
    const next = saveContent({ ...content, status: "DRAFTING" });
    onRejected?.(next);
    onClose?.();
  };

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title="Approve content"
      subtitle="Review before it moves to the schedule."
      width="md"
      footer={(
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="rl-btn" onClick={approve}>Approve</button>
          <Link to={`/content/${content.id}`} className="rl-btn-ghost" onClick={onClose}>Edit</Link>
          <button type="button" className="rl-btn-ghost" onClick={reject}>Reject</button>
        </div>
      )}
    >
      <div className="space-y-5">
        <div>
          <p className="rl-label">Title</p>
          <p className="mt-1 text-sm font-medium text-rl_text">{content.title || "Untitled"}</p>
        </div>
        {caption && (
          <div>
            <p className="rl-label">Caption</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-rl_textSecondary">{caption}</p>
          </div>
        )}
        <div>
          <p className="rl-label">Accounts</p>
          {linked.length === 0 ? (
            <p className="mt-1 text-sm text-rl_muted">No accounts attached.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm text-rl_textSecondary">
              {linked.map((account) => (
                <li key={account.id}>
                  {account.platform} · {account.handle || account.displayName}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="rl-label">Schedule</p>
          <p className="mt-1 text-sm text-rl_textSecondary">{formatStamp(scheduleAt)}</p>
          {!content.scheduledAt && (
            <p className="mt-1 text-xs text-rl_muted">No time set — approving schedules about an hour from now.</p>
          )}
        </div>
      </div>
    </SideSheet>
  );
}
