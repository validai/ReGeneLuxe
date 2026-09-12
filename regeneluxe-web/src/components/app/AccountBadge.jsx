import { resolveAccount } from "../../data/accountRepository.js";

export default function AccountBadge({ accountId, accounts, fallback = "Account removed" }) {
  const account = resolveAccount(accountId, accounts);
  if (!account) {
    return (
      <span className="inline-flex rounded-full bg-rl_warning/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-rl_warning">
        {fallback}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rl_surfaceSoft px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-rl_text">
      {account.platform}
      <span className="text-rl_muted">{account.handle || account.displayName}</span>
    </span>
  );
}
