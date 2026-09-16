import { z } from "zod";

/** Sprint 89 — runtime validation for core domain enums (shared Vite/Next). */

export const ContentStatusSchema = z.enum([
  "IDEA",
  "PLANNED",
  "DRAFTING",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
]);

export const PlatformSchema = z.enum([
  "Instagram",
  "YouTube",
  "TikTok",
  "X",
  "Threads",
  "Facebook",
  "SoundCloud",
  "LinkedIn",
  "Snapchat",
  "Twitch",
  "Kick",
  "Other",
]);

export const ConnectionStateSchema = z.enum([
  "MANUAL",
  "CONNECTED",
  "ERROR",
  "AUTH_EXPIRED",
  "DISCONNECTED",
]);

export const AccountDraftSchema = z.object({
  platform: PlatformSchema.or(z.string().min(1)),
  displayName: z.string().optional(),
  handle: z.string().optional(),
  connectionState: ConnectionStateSchema.optional(),
});

export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export type Platform = z.infer<typeof PlatformSchema>;
