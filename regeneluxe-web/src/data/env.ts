import { z } from "zod";

/** Sprint 97 — typed development env (no secrets in client bundles). */
export const EnvSchema = z.object({
  REGENELUXE_UI_PORT: z.string().optional(),
  REGENELUXE_API_PORT: z.string().optional(),
  REGENELUXE_NEXT_PORT: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
});

export function readServerEnv(env: NodeJS.ProcessEnv = process.env) {
  return EnvSchema.parse({
    REGENELUXE_UI_PORT: env.REGENELUXE_UI_PORT,
    REGENELUXE_API_PORT: env.REGENELUXE_API_PORT,
    REGENELUXE_NEXT_PORT: env.REGENELUXE_NEXT_PORT,
    NODE_ENV: env.NODE_ENV,
  });
}
