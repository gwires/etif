// Import users and issues from export JSON into fresh DB.
// Usage: scripts/run.sh deno run --allow-env --allow-net --allow-read import.ts

import { execute, withTransaction, closePool } from "./api/db.ts";
import { extractUrls } from "./api/captures/extract_urls.ts";

const inDir = "export";

interface User {
  id: string;
  username: string;
  password_hash: string | null;
  created_at: string;
}

interface Issue {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
}

async function main() {
  const usersRaw = await Deno.readTextFile(`${inDir}/users.json`);
  const issuesRaw = await Deno.readTextFile(`${inDir}/issues.json`);
  const users: User[] = JSON.parse(usersRaw);
  const issues: Issue[] = JSON.parse(issuesRaw);

  if (users.length === 0) {
    console.error("No users found in export.");
    Deno.exit(1);
  }

  await withTransaction(async (tx) => {
    // Insert users with original password hashes
    for (const u of users) {
      await tx.execute(
        `INSERT INTO users (id, username, password_hash, created_at)
         VALUES ($1, $2, $3, $4)`,
        [u.id, u.username, u.password_hash, new Date(u.created_at)],
      );
    }

    // Assign all captures to the first user
    const ownerId = users[0].id;

    for (const issue of issues) {
      const title = issue.title || "Untitled";
      const whatText = issue.body ?? null;
      const createdAt = new Date(issue.created_at);

      await tx.execute(
        `INSERT INTO captures (id, user_id, title, status, what_text, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [issue.id, ownerId, title, "***", whatText, createdAt],
      );

      // Extract URLs from markdown fields
      const urls = extractUrls(whatText);
      for (const url of urls) {
        await tx.execute(
          `INSERT INTO capture_urls (capture_id, url) VALUES ($1, $2)`,
          [issue.id, url],
        );
      }
    }
  });

  console.log(`Imported ${users.length} users, ${issues.length} issues.`);
  await closePool();
}

main();
