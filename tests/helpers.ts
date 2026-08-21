// Shared test utilities.
// Provides DB connection for integration tests and cleanup helpers.
// All test-side-effect rows use '_test_' prefix for easy identification and cleanup.

import { Client } from "jsr:@db/postgres@0.19";
import { config } from "../api/config.ts";

const TEST_AVATAR_DIR = config.avatarDir;

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

  // Collect test user IDs before deleting users (needed for avatar cleanup)
  let testUserIds: string[] = [];
  try {
    const result = await client.queryObject<{ id: string }>(
      "SELECT id FROM users WHERE username LIKE '_test_%'",
    );
    testUserIds = result.rows.map((r) => r.id);
  } catch { /* ignore */ }

  // Order matters due to foreign keys — delete dependents first.
  await client.queryArray("DELETE FROM capture_urls WHERE capture_id IN (SELECT id FROM captures WHERE title LIKE '_test_%')");
  await client.queryArray("DELETE FROM capture_images WHERE capture_id IN (SELECT id FROM captures WHERE title LIKE '_test_%')");
  await client.queryArray("DELETE FROM capture_regions WHERE capture_id IN (SELECT id FROM captures WHERE title LIKE '_test_%')");
  await client.queryArray("DELETE FROM captures WHERE title LIKE '_test_%'");
  await client.queryArray("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username LIKE '_test_%')");
  await client.queryArray("DELETE FROM captcha_challenges WHERE challenge_data::text LIKE '%_test_%'");
  await client.queryArray("DELETE FROM users WHERE username LIKE '_test_%'");

  // Clean up test avatar files (named {userId}-{timestamp}.ext)
  if (testUserIds.length > 0) {
    const testIdSet = new Set(testUserIds);
    try {
      for await (const entry of Deno.readDir(TEST_AVATAR_DIR)) {
        if (entry.isFile && testIdSet.has(entry.name.split("-")[0])) {
          await Deno.remove(`${TEST_AVATAR_DIR}/${entry.name}`);
        }
      }
    } catch {
      // Directory may not exist
    }
  }
}

/** Generate a unique test username. */
export function testUsername(suffix: string): string {
  return `_test_${suffix}`;
}
