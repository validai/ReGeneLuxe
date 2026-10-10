#!/usr/bin/env node
/**
 * Threads-only local HTTPS callback bridge.
 * Listens on 127.0.0.1:5175 for threads.regeneluxe.test.
 * Does not start Next, does not proxy other paths, and does not log query strings.
 */
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:https";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handleThreadsHttpsRequest, THREADS_BRIDGE_PORT } from "../server/connectors/threadsHttpsBridge.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CERT = join(ROOT, ".certs", "threads.regeneluxe.test.pem");
const KEY = join(ROOT, ".certs", "threads.regeneluxe.test-key.pem");

if (process.env.NODE_ENV === "production") {
  console.error("The Threads HTTPS bridge is local development only.");
  process.exit(1);
}
if (!existsSync(CERT) || !existsSync(KEY)) {
  console.error("Local certificate files are missing.");
  console.error("Create them with mkcert into regeneluxe-web/.certs and do not commit them.");
  process.exit(1);
}

const server = createServer({
  cert: readFileSync(CERT),
  key: readFileSync(KEY),
}, (request, response) => {
  request.resume();
  const result = handleThreadsHttpsRequest({
    method: request.method,
    url: request.url,
    host: request.headers.host,
  });
  response.writeHead(result.status, result.headers);
  response.end(result.body);
});

server.listen(THREADS_BRIDGE_PORT, "127.0.0.1", () => {
  console.log(`Threads HTTPS bridge listening on 127.0.0.1:${THREADS_BRIDGE_PORT}`);
});
