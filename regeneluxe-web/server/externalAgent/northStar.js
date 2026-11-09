/**
 * Canonical product identity for trusted external analysts.
 * Read-only. Never grants control.
 */

export const NORTH_STAR = Object.freeze({
  product: "ReGeneLuxe",
  statement:
    "ReGeneLuxe is a private AI campaign and relationship command center for creators and artist brands.",
  purpose:
    "Reduce the manual work required to operate and grow one creator/artist brand across multiple social networks.",
  job:
    "Its job is to reduce the manual work required to operate and grow one creator/artist brand across multiple social networks.",
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
  behavesLike: Object.freeze([
    "campaign manager",
    "social operations assistant",
    "analyst",
    "networking assistant",
  ]),
  scope: "ONE brand",
  notMerely: Object.freeze([
    "a scheduler",
    "a caption generator",
    "a generic CRM",
    "a Canva replacement",
    "an enterprise agency dashboard",
  ]),
  agentRole: "trusted analyst / product collaborator",
  agentRoleNot: "autonomous administrator",
});

export function northStarPayload() {
  return {
    ok: true,
    ...NORTH_STAR,
    retrievedAt: new Date().toISOString(),
  };
}
