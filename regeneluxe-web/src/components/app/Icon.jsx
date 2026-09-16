"use client";

import {
  SquaresFour,
  CalendarBlank,
  ArticleNyTimes,
  FlagBanner,
  Tray,
  ChartBar,
  UsersThree,
  ListBullets,
  MagnifyingGlass,
  GearSix,
  Plus,
  CaretLeft,
  CaretRight,
  PencilSimple,
  Trash,
  Copy,
  Clock,
  PaperPlaneTilt,
  UploadSimple,
  DownloadSimple,
  Funnel,
  ArrowsClockwise,
  PlugsConnected,
  Plugs,
  Check,
  X,
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  CaretDown,
  CaretUp,
  DotsThree,
  Bell,
  WarningCircle,
  CheckCircle,
  XCircle,
  Info,
  Sparkle,
  InstagramLogo,
  YoutubeLogo,
  TiktokLogo,
  XLogo,
  ThreadsLogo,
  FacebookLogo,
  SoundcloudLogo,
  LinkedinLogo,
  SnapchatLogo,
  TwitchLogo,
  Broadcast,
  Globe,
} from "@phosphor-icons/react";

/** Standard icon sizes (px). */
// eslint-disable-next-line react-refresh/only-export-components -- size token map
export const ICON_SIZES = {
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
};

const NAV = {
  dash: SquaresFour,
  calendar: CalendarBlank,
  cal: CalendarBlank,
  content: ArticleNyTimes,
  camp: FlagBanner,
  campaigns: FlagBanner,
  inbox: Tray,
  analytics: ChartBar,
  accounts: UsersThree,
  queue: ListBullets,
  search: MagnifyingGlass,
  settings: GearSix,
  create: Plus,
  expand: CaretRight,
  collapse: CaretLeft,
};

const ACTIONS = {
  create: Plus,
  edit: PencilSimple,
  delete: Trash,
  duplicate: Copy,
  schedule: Clock,
  publish: PaperPlaneTilt,
  upload: UploadSimple,
  download: DownloadSimple,
  filter: Funnel,
  search: MagnifyingGlass,
  refresh: ArrowsClockwise,
  connect: PlugsConnected,
  disconnect: Plugs,
  approve: Check,
  reject: X,
  retry: ArrowCounterClockwise,
  back: ArrowLeft,
  forward: ArrowRight,
  close: X,
  expand: CaretDown,
  collapse: CaretUp,
  more: DotsThree,
  notification: Bell,
  attention: WarningCircle,
  success: CheckCircle,
  warning: WarningCircle,
  error: XCircle,
  info: Info,
  sparkle: Sparkle,
};

/**
 * Bold monochrome Phosphor icon. Uses currentColor.
 */
export default function Icon({
  name,
  size = "md",
  weight = "bold",
  className = "",
  decorative = true,
  label,
}) {
  const Comp = NAV[name] || ACTIONS[name] || SquaresFour;
  const px = typeof size === "number" ? size : ICON_SIZES[size] || ICON_SIZES.md;
  return (
    <Comp
      size={px}
      weight={weight}
      className={`shrink-0 ${className}`}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label || name}
      role={decorative ? undefined : "img"}
    />
  );
}

export function NavIcon({ name, size = 20, className = "" }) {
  return <Icon name={name} size={size} weight="fill" className={className} />;
}

const PLATFORM_MARKS = {
  Instagram: InstagramLogo,
  YouTube: YoutubeLogo,
  TikTok: TiktokLogo,
  X: XLogo,
  Threads: ThreadsLogo,
  Facebook: FacebookLogo,
  SoundCloud: SoundcloudLogo,
  LinkedIn: LinkedinLogo,
  Snapchat: SnapchatLogo,
  Twitch: TwitchLogo,
  Kick: Broadcast,
  Other: Globe,
};

/** Monochrome platform mark from the existing Phosphor set. Kick has no brand glyph. */
export function PlatformIcon({ platform, size = "md", className = "" }) {
  const Comp = PLATFORM_MARKS[platform] || Globe;
  const px = typeof size === "number" ? size : ICON_SIZES[size] || ICON_SIZES.md;
  return (
    <Comp
      size={px}
      weight="bold"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    />
  );
}
