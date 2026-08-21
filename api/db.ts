// Database connection utility.
// Thin wrapper around @db/postgres Pool — exposes query helpers for the rest of the API.
// No caching, no ORM. Parameterized queries only.

import { Client, Pool } from "jsr:@db/postgres@0.19";
import { config } from "./config.ts";

const pool = new Pool(config.databaseUrl, 4);

/** Execute a query returning rows as objects. */
export async function query<T extends Record<string, unknown>>(
  text: string,
  args?: unknown[],
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.queryObject<T>(text, args);
    return result.rows;
  } finally {
    client.release();
  }
}

/** Execute a query returning a single row or null. */
export async function queryOne<T extends Record<string, unknown>>(
  text: string,
  args?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, args);
  return rows[0] ?? null;
}

/** Execute a non-SELECT statement, return affected row count. */
export async function execute(
  text: string,
  args?: unknown[],
): Promise<number> {
  const client = await pool.connect();
  try {
    const result = await client.queryArray(text, args);
    return result.rowCount ?? 0;
  } finally {
    client.release();
  }
}

/** Run multiple statements in a transaction. Rolls back on error. */
export async function withTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.queryArray("BEGIN");
    const tx = new TransactionClient(client);
    const result = await fn(tx);
    await client.queryArray("COMMIT");
    return result;
  } catch (err) {
    await client.queryArray("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Close the pool. Call at shutdown or end of tests to release connections. */
export async function closePool(): Promise<void> {
  await pool.end();
}

/** Scoped client for use inside transactions. Same interface as top-level helpers. */
export class TransactionClient {
  #client: Client;

  constructor(client: Client) {
    this.#client = client;
  }

  async query<T extends Record<string, unknown>>(
    text: string,
    args?: unknown[],
  ): Promise<T[]> {
    const result = await this.#client.queryObject<T>(text, args);
    return result.rows;
  }

  async queryOne<T extends Record<string, unknown>>(
    text: string,
    args?: unknown[],
  ): Promise<T | null> {
    const rows = await this.query<T>(text, args);
    return rows[0] ?? null;
  }

  async execute(text: string, args?: unknown[]): Promise<number> {
    const result = await this.#client.queryArray(text, args);
    return result.rowCount ?? 0;
  }
}
