// Application configuration read from environment variables.
// Fail fast at startup if required vars are missing.

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return Deno.env.get(name) ?? fallback;
}

export const config = {
  databaseUrl: requireEnv("DATABASE_URL"),
  port: parseInt(optionalEnv("PORT", "8000"), 10),
  sessionSecret: optionalEnv("SESSION_SECRET", ""),
  oidc: {
    issuerUrl: optionalEnv("OIDC_ISSUER_URL", ""),
    clientId: optionalEnv("OIDC_CLIENT_ID", ""),
    clientSecret: optionalEnv("OIDC_CLIENT_SECRET", ""),
    redirectUri: optionalEnv("OIDC_REDIRECT_URI", "http://localhost:5173/auth/callback"),
  },
};
