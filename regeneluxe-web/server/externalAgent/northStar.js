/**
 * Canonical product identity for trusted external analysts.
 * Read-only. Never grants control.
 */

export const NORTH_STAR = Object.freeze({
  product: "ReGeneLuxe",
  statement:
    "ReGeneLuxe is an AI campaign, publishing, relationship, and performance command center for individuals, public figures, brands, organizations, and teams managing a public presence across multiple networks.",
  purpose:
    "Reduce the manual work required to operate and grow one public presence across multiple social networks.",
  job:
    "Its job is to reduce the manual work required to operate and grow one public presence across multiple social networks.",
  coreLoop: Object.freeze([
    "SOURCE",
    "PLAN",
    "ADAPT",
    "APPROVE",
    "DISTRIBUTE",
    "ENGAGE",
    "OBSERVE",
    "LEARN",
    "NEXT MOVE",
  ]),
  operatingStatement:
    "Create once → intelligently distribute → efficiently network → learn → make the next move better.",
  humanControl: "Human operator retains final control.",
  marketingTeam: Object.freeze({
    note: "Informational identity only. No role-specific elevated bridge permissions in V1.",
    roles: Object.freeze([
      Object.freeze({
        id: "MR_ENTREPRENEUR",
        name: "MR ENTREPRENEUR",
        focus: "campaign strategy, rollout, timing, scheduling direction",
      }),
      Object.freeze({
        id: "GOOD_POST_REVIEWS",
        name: "GOOD POST REVIEWS",
        focus: "network-specific copy, content preparation, publishing operations",
      }),
      Object.freeze({
        id: "REGENELUXE",
        name: "REGENELUXE",
        focus: "authoritative campaign/account/readiness/approval/queue/results hub",
      }),
      Object.freeze({
        id: "HUMAN_OPERATOR",
        name: "HUMAN OPERATOR",
        focus: "final authority",
      }),
    ]),
  }),
  behavesLike: Object.freeze([
    "campaign manager",
    "social operations assistant",
    "analyst",
    "networking assistant",
  ]),
  scope: "ONE public presence / workspace",
  notMerely: Object.freeze([
    "a scheduler",
    "a caption generator",
    "a generic CRM",
    "a Canva replacement",
    "an enterprise agency dashboard",
  ]),
  agentRole: "trusted analyst / product collaborator",
  agentRoleNot: "autonomous administrator",
  verticalNote:
    "Music, album, song, artist, and fan concepts belong to campaign templates and vertical metadata — not universal product assumptions.",
});

export function northStarPayload() {
  return {
    ok: true,
    ...NORTH_STAR,
    retrievedAt: new Date().toISOString(),
  };
}
