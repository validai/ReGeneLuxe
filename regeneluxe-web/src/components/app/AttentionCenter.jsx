import { useMemo, useState } from "react";
import { useAppNavigate as useNavigate } from "@/nav";
import AttentionItem from "./AttentionItem.jsx";
import ApprovalSheet from "./ApprovalSheet.jsx";
import { formatStamp } from "../../utils/dates.js";

function isApprovalItem(item, readyContent = []) {
  if (!item) return false;
  if (item.kind === "approval" || item.contentId) return true;
  if (!item.href?.startsWith("/content/")) return false;
  return readyContent.some((entry) => item.href === `/content/${entry.id}`);
}

function isConnectionItem(item) {
  return item?.kind === "connection" || item?.href === "/accounts";
}

export default function AttentionCenter({
  title = "Needs you",
  items = [],
  events = [],
  emptyMessage = "Nothing needs you right now.",
  accounts = [],
  content = [],
  maxItems = 5,
  maxEvents = 5,
  showEvents = false,
  forceApprovalId = null,
  onForceApprovalHandled,
}) {
  const navigate = useNavigate();
  const [pickedId, setPickedId] = useState(null);

  const readyContent = useMemo(
    () => content.filter((item) => item.status === "READY"),
    [content]
  );

  const approvalId = pickedId || forceApprovalId || null;

  const visible = items.slice(0, maxItems);
  const recent = showEvents ? events.slice(0, maxEvents) : [];

  const approvalTarget = content.find((item) => item.id === approvalId)
    || readyContent[0]
    || null;

  const openApproval = (item) => {
    const id = item?.contentId
      || (item?.href?.startsWith("/content/") ? item.href.replace("/content/", "") : null)
      || readyContent[0]?.id;
    if (id) setPickedId(id);
  };

  const closeApproval = () => {
    setPickedId(null);
    if (forceApprovalId) onForceApprovalHandled?.();
  };

  return (
    <section>
      <h2 className="rl-label">{title}</h2>
      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-rl_muted">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((item) => {
            const approval = isApprovalItem(item, readyContent);
            const connection = isConnectionItem(item);
            return (
              <li key={`${item.level}-${item.message}-${item.contentId || item.href || ""}`}>
                <AttentionItem
                  level={item.level}
                  message={item.message}
                  href={approval || connection ? undefined : item.href}
                  onAction={
                    approval
                      ? () => openApproval(item)
                      : connection
                        ? () => navigate("/accounts")
                        : undefined
                  }
                  actionLabel={approval ? "Review" : connection ? "Reconnect" : undefined}
                />
              </li>
            );
          })}
        </ul>
      )}

      {recent.length > 0 && (
        <div className="mt-8">
          <h3 className="rl-label">Recent</h3>
          <ul className="mt-3 space-y-2">
            {recent.map((event) => (
              <li key={event.id} className="text-sm text-rl_muted">
                {event.message || event.type.replaceAll("_", " ").toLowerCase()}
                <span className="ml-2 text-xs opacity-70">{formatStamp(event.timestamp)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ApprovalSheet
        open={Boolean(approvalId)}
        content={approvalTarget}
        accounts={accounts}
        onClose={closeApproval}
      />
    </section>
  );
}
