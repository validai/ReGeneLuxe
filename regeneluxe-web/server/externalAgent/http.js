import { jsonPrivate } from "../auth/apiGuard.js";

export function bridgeJson(result) {
  const status = result.status || (result.ok ? 200 : 400);
  const body = { ...result };
  delete body.status;
  delete body.sessionRow;
  return jsonPrivate(body, status);
}
