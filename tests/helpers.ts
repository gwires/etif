// Shared test utilities.
// Provides DB connection for integration tests and cleanup helpers.
// All test-side-effect rows use '_test_' prefix for easy identification and cleanup.

import { Client } from "jsr:@db/postgres@0.19";
import { config } from "../api/config.ts";

let sharedClient: Client | null = null;

/** Get a shared DB client for tests. Reused across tests to avoid pool overhead. */
export async function getTestClient(): Promise<Client> {
  if (!sharedClient) {
    sharedClient = new Client(config.databaseUrl);
    await sharedClient.connect();
  }
  return sharedClient;
}

/** Close the shared test client. Call at end of test suites to prevent resource leaks. */
export async function closeTestClient(): Promise<void> {
  if (sharedClient) {
    await sharedClient.end();
    sharedClient = null;
  }
}

/** Clean up all rows created by tests (those with _test_ prefix in key columns). */
export async function cleanupTestData(): Promise<void> {
  const client = await getTestClient();
  // Order matters due to foreign keys — delete dependents first.
  await client.queryArray("DELETE FROM votes WHERE target_id::text LIKE '_test_%'");
  await client.queryArray("DELETE FROM comments WHERE body LIKE '%_test_%'");
  await client.queryArray("DELETE FROM issue_citations WHERE issue_id IN (SELECT id FROM issues WHERE title LIKE '_test_%')");
  await client.queryArray("DELETE FROM issue_regions WHERE issue_id IN (SELECT id FROM issues WHERE title LIKE '_test_%')");
  await client.queryArray("DELETE FROM issue_tags WHERE issue_id IN (SELECT id FROM issues WHERE title LIKE '_test_%')");
  await client.queryArray("DELETE FROM issue_relations WHERE source_id IN (SELECT id FROM issues WHERE title LIKE '_test_%') OR target_id IN (SELECT id FROM issues WHERE title LIKE '_test_%')");
  await client.queryArray("DELETE FROM issue_versions WHERE issue_id IN (SELECT id FROM issues WHERE title LIKE '_test_%')");
  await client.queryArray("DELETE FROM issues WHERE title LIKE '_test_%'");
  await client.queryArray("DELETE FROM tags WHERE name LIKE '_test_%'");
  await client.queryArray("DELETE FROM citations WHERE url LIKE '%_test_%'");
  await client.queryArray("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username LIKE '_test_%')");
  await client.queryArray("DELETE FROM captcha_challenges WHERE challenge_data::text LIKE '%_test_%'");
  await client.queryArray("DELETE FROM users WHERE username LIKE '_test_%'");
}

/** Generate a unique test username. */
export function testUsername(suffix: string): string {
  return `_test_${suffix}`;
}
