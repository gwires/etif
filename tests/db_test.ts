// Integration tests for api/db.ts.
// Tests query, queryOne, execute, withTransaction against live PostgreSQL.

import { describe, it } from "jsr:@std/testing@1/bdd";
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { query, queryOne, execute, withTransaction, closePool } from "../api/db.ts";
import { cleanupTestData, closeTestClient, testUsername } from "./helpers.ts";

// Sanitizers disabled: DB pool opens connections outside test lifecycle by design.
// Each test properly cleans up its own side effects via finally blocks.
describe("db", { sanitizeOps: false, sanitizeResources: false }, () => {
  // Clean up before and after all tests in this suite
  it("setup: cleanup test data", async () => {
    await cleanupTestData();
  });

  it("query returns rows as objects", async () => {
    const rows = await query<{ n: number }>(
      "SELECT $1::int as n UNION ALL SELECT $2::int",
      [1, 2],
    );
    assertEquals(rows.length, 2);
    assertEquals(rows[0].n, 1);
    assertEquals(rows[1].n, 2);
  });

  it("query returns empty array on no results", async () => {
    const rows = await query("SELECT 1 WHERE false");
    assertEquals(rows.length, 0);
  });

  it("queryOne returns single row", async () => {
    const row = await queryOne<{ greeting: string }>(
      "SELECT $1::text as greeting",
      ["hello"],
    );
    assertEquals(row?.greeting, "hello");
  });

  it("queryOne returns null on no match", async () => {
    const row = await queryOne("SELECT 1 WHERE false");
    assertEquals(row, null);
  });

  it("execute returns affected row count on insert", async () => {
    const username = testUsername("exec_insert");
    try {
      const count = await execute(
        "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
        [username, "fake_hash"],
      );
      assertEquals(count, 1);

      const row = await queryOne<{ username: string }>(
        "SELECT username FROM users WHERE username = $1",
        [username],
      );
      assertEquals(row?.username, username);
    } finally {
      await execute("DELETE FROM users WHERE username = $1", [username]);
    }
  });

  it("execute returns affected row count on delete", async () => {
    const username = testUsername("exec_delete");
    await execute(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
      [username, "fake_hash"],
    );
    const count = await execute("DELETE FROM users WHERE username = $1", [username]);
    assertEquals(count, 1);
  });

  it("parameterized queries prevent SQL injection", async () => {
    const malicious = "'; DROP TABLE users; --";
    const username = testUsername("injection");
    try {
      await execute(
        "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
        [username, malicious],
      );

      // Malicious string stored literally, not executed
      const row = await queryOne<{ password_hash: string }>(
        "SELECT password_hash FROM users WHERE username = $1",
        [username],
      );
      assertEquals(row?.password_hash, malicious);

      // Users table still exists
      const count = await queryOne<{ c: number }>("SELECT count(*)::int as c FROM users");
      assertEquals((count?.c ?? 0) > 0, true);
    } finally {
      await execute("DELETE FROM users WHERE username = $1", [username]);
    }
  });

  it("withTransaction commits on success", async () => {
    const username = testUsername("tx_commit");
    try {
      const result = await withTransaction(async (tx) => {
        await tx.execute(
          "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
          [username, "fake_hash"],
        );
        return "committed";
      });
      assertEquals(result, "committed");

      const row = await queryOne("SELECT 1 FROM users WHERE username = $1", [username]);
      assertEquals(row !== null, true);
    } finally {
      await execute("DELETE FROM users WHERE username = $1", [username]);
    }
  });

  it("withTransaction rolls back on error", async () => {
    const username = testUsername("tx_rollback");
    await assertRejects(
      async () => {
        await withTransaction(async (tx) => {
          await tx.execute(
            "INSERT INTO users (username, password_hash) VALUES ($1, $2)",
            [username, "fake_hash"],
          );
          throw new Error("intentional failure");
        });
      },
      Error,
      "intentional failure",
    );

    // Row should not exist — rolled back
    const row = await queryOne("SELECT 1 FROM users WHERE username = $1", [username]);
    assertEquals(row, null);
  });

  it("transaction client query and queryOne work", async () => {
    const result = await withTransaction(async (tx) => {
      const rows = await tx.query<{ n: number }>("SELECT $1::int as n", [42]);
      const one = await tx.queryOne<{ n: number }>("SELECT $1::int as n", [99]);
      return { rows, one };
    });
    assertEquals(result.rows.length, 1);
    assertEquals(result.rows[0].n, 42);
    assertEquals(result.one?.n, 99);
  });

  it("teardown: cleanup test data and close connections", async () => {
    await cleanupTestData();
    await closeTestClient();
    await closePool();
  });
});
