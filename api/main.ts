// Main entry point for the API server.

import { STATUS_CODE } from "./deps.ts";
import { config, optionalEnv } from "./config.ts";
import { generateCaptcha } from "./auth/captcha.ts";
import { handleSignup } from "./auth/signup.ts";
import { handleLogin } from "./auth/login.ts";
import { handleMe, handleLogout } from "./auth/middleware.ts";
import { handleListIssues, handleCreateIssue, handleGetIssue, handleUpdateIssue } from "./issues/handlers.ts";
import { handleGetRelations, handleCreateRelation, handleUpdateRelation, handleDeleteRelation } from "./relations/handlers.ts";
import { handleGetRegions, handleCreateRegion, handleDeleteRegion, handleFindIssuesByRegion } from "./regions/handlers.ts";
import { handleListComments, handleCreateComment } from "./comments/handlers.ts";
import { handleVote } from "./votes/handlers.ts";
import { handleGraph } from "./graph/handlers.ts";

const CORS_ORIGIN = optionalEnv("CORS_ORIGIN", "http://localhost:5173");

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function withCors(res: Response): Response {
  for (const [k, v] of Object.entries(corsHeaders())) res.headers.set(k, v);
  return res;
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Auth routes
  if (path === "/api/auth/captcha" && method === "GET") {
    const captcha = await generateCaptcha();
    return json(captcha);
  }
  if (path === "/api/auth/signup" && method === "POST") {
    return handleSignup(req);
  }
  if (path === "/api/auth/login" && method === "POST") {
    return handleLogin(req);
  }
  if (path === "/api/auth/me" && method === "GET") {
    return handleMe(req);
  }
  if (path === "/api/auth/logout" && method === "DELETE") {
    return handleLogout(req);
  }

  // Issues routes
  if (path === "/api/issues" && method === "GET") {
    return handleListIssues(req);
  }
  if (path === "/api/issues" && method === "POST") {
    return handleCreateIssue(req);
  }
  const issueMatch = path.match(/^\/api\/issues\/([0-9a-f-]+)$/);
  if (issueMatch) {
    if (method === "GET") return handleGetIssue(req);
    if (method === "PATCH") return handleUpdateIssue(req);
  }

  // Relations routes
  const issueRelationsMatch = path.match(/^\/api\/issues\/([0-9a-f-]+)\/relations$/);
  if (issueRelationsMatch) {
    if (method === "GET") return handleGetRelations(req);
    if (method === "POST") return handleCreateRelation(req);
  }
  const relationMatch = path.match(/^\/api\/relations\/([0-9a-f-]+)$/);
  if (relationMatch) {
    if (method === "PATCH") return handleUpdateRelation(req);
    if (method === "DELETE") return handleDeleteRelation(req);
  }

  // Regions routes
  const issueRegionsMatch = path.match(/^\/api\/issues\/([0-9a-f-]+)\/regions$/);
  if (issueRegionsMatch) {
    if (method === "GET") return handleGetRegions(req);
    if (method === "POST") return handleCreateRegion(req);
  }
  const regionMatch = path.match(/^\/api\/regions\/([0-9a-f-]+)$/);
  if (regionMatch && method === "DELETE") {
    return handleDeleteRegion(req);
  }
  if (path === "/api/regions" && method === "GET") {
    return handleFindIssuesByRegion(req);
  }

  // Comments routes
  const issueCommentsMatch = path.match(/^\/api\/issues\/([0-9a-f-]+)\/comments$/);
  if (issueCommentsMatch) {
    if (method === "GET") return handleListComments(req);
    if (method === "POST") return handleCreateComment(req);
  }

  // Votes route
  if (path === "/api/votes" && method === "POST") {
    return handleVote(req);
  }

  // Graph route
  if (path === "/api/graph" && method === "GET") {
    return handleGraph(req);
  }

  // Health check
  if (path === "/api/health") {
    return json({ status: "ok" });
  }

  return json({ error: "Not found" }, STATUS_CODE.NotFound);
}

function json(data: unknown, status: number = STATUS_CODE.OK): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

console.log(`API server listening on http://localhost:${config.port}`);
Deno.serve({ port: config.port }, async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }
  const res = await handler(req);
  return withCors(res);
});
