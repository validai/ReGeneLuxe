/**
 * Next.js instrumentation entry.
 * Node-only runtime (job ticker + exit observability) loads via dynamic import.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerNodeRuntime } = await import("./server/runtime/registerNodeRuntime.js");
  await registerNodeRuntime();
}
