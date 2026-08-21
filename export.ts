// Export users and issues to JSON files for schema migration.
// Usage: scripts/run.sh deno run --allow-env --allow-net --allow-write export.ts

import { query } from "./api/db.ts";
import { closePool } from "./api/db.ts";

const outDir = "export";

interface User {
  id: string;
  username: string;
  created_at: Date;
}

interface Issue {
  id: string;
  title: string;
  body: string | null;
  created_at: Date;
}

async function main() {
  await Deno.mkdir(outDir, { recursive: true });

  const users = await query<User>(
    "SELECT id, username, created_at FROM users ORDER BY created_at",
  );
  const issues = await query<Issue>(
    "SELECT id, title, body, created_at FROM issues ORDER BY created_at",
  );

  await Deno.writeTextFile(
    `${outDir}/users.json`,
    JSON.stringify(users, null, 2) + "\n",
  );
  await Deno.writeTextFile(
    `${outDir}/issues.json`,
    JSON.stringify(issues, null, 2) + "\n",
  );

  console.log(`Exported ${users.length} users, ${issues.length} issues → ${outDir}/`);
  await closePool();
}

main();
