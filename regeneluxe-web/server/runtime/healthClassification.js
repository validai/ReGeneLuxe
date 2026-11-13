/**
 * Classify ReGeneLuxe /api/health components.
 *
 * Core execution does NOT require AI configuration.
 * Optional AI absence must not mark the runtime DEGRADED.
 */

export const OPTIONAL_COMPONENT_AI = "ai_not_configured";

/**
 * @param {{
 *   localHealthy: boolean,
 *   aiConfigured: boolean,
 *   syncState?: string,
 *   schedulerDisabled?: boolean,
 *   schedulerEnabled?: boolean,
 *   schedulerLastTickOk?: boolean | null,
 *   schedulerHasTick?: boolean,
 *   productionRuntime?: boolean,
 * }} input
 */
export function classifyHealthComponents(input = {}) {
  const degraded = [];
  const optional = [];

  if (!input.localHealthy) degraded.push("database");

  if (!input.aiConfigured) optional.push(OPTIONAL_COMPONENT_AI);

  if (input.schedulerDisabled) {
    degraded.push("scheduler_disabled");
  } else if (input.schedulerEnabled && input.schedulerLastTickOk === false) {
    degraded.push("scheduler_last_tick_failed");
  } else if (
    input.productionRuntime
    && !input.schedulerEnabled
    && !input.schedulerDisabled
  ) {
    degraded.push("scheduler_not_started");
  }

  const syncState = String(input.syncState || "");
  if (syncState === "ERROR" || syncState === "CONFLICT") {
    degraded.push(`sync_${syncState.toLowerCase()}`);
  }

  let status = "OK";
  if (!input.localHealthy) status = "UNHEALTHY";
  else if (degraded.length > 0) status = "DEGRADED";

  return {
    status,
    ok: status !== "UNHEALTHY",
    degradedComponents: degraded,
    optionalComponents: optional,
    coreOperational: Boolean(input.localHealthy) && status !== "UNHEALTHY",
  };
}

/** Operator-facing labels — core vs optional AI. */
export function describeHealthForOperator({ status, aiConfigured, coreOperational } = {}) {
  if (!coreOperational || status === "UNHEALTHY") {
    return {
      coreLabel: "Core system unavailable",
      aiLabel: aiConfigured ? "Optional AI configured" : "Optional AI not configured",
      summary: "Core ReGeneLuxe runtime is not healthy.",
    };
  }
  if (status === "DEGRADED") {
    return {
      coreLabel: "Core system operational (degraded)",
      aiLabel: aiConfigured ? "Optional AI configured" : "Optional AI not configured",
      summary: "Core ReGeneLuxe is running with one or more degraded core components. AI configuration is optional.",
    };
  }
  return {
    coreLabel: "Core system operational",
    aiLabel: aiConfigured ? "Optional AI configured" : "Optional AI not configured",
    summary: aiConfigured
      ? "Core ReGeneLuxe is operational. Optional AI is configured."
      : "Core ReGeneLuxe is operational. Optional AI is not configured — this does not block publishing or scheduling.",
  };
}
