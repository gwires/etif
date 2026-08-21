// Main entry point for the API server.
// Scaffolds an HTTP server; routes will be wired in subsequent tasks.

import { STATUS_CODE } from "./deps.ts";
import { config } from "./config.ts";

function handler(_req: Request): Response {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: STATUS_CODE.OK,
    headers: { "Content-Type": "application/json" },
  });
}

console.log(`API server listening on http://localhost:${config.port}`);
Deno.serve({ port: config.port }, handler);
