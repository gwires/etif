// Captcha challenge generation and verification.
// Puzzles are generated server-side; answers stored as SHA-256 hashes.
// Challenges are single-use and expire after 5 minutes.

import { encodeHex } from "../deps.ts";
import { queryOne, execute } from "../db.ts";

const CAPTCHA_EXPIRY_MINUTES = 5;

type ChallengeGenerator = () => { data: Record<string, unknown>; answer: string };

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- Puzzle generators ---

function generateArithmetic(): { data: Record<string, unknown>; answer: string } {
  const ops = ["+", "-", "*"];
  const op = pickRandom(ops);
  let a: number, b: number, c: number;
  let question!: string;
  let answer!: number;

  switch (op) {
    case "+":
      a = randomInt(1, 20);
      b = randomInt(1, 20);
      question = `What is ${a} + ${b}?`;
      answer = a + b;
      break;
    case "-":
      a = randomInt(5, 30);
      b = randomInt(1, a); // ensure positive result
      question = `What is ${a} - ${b}?`;
      answer = a - b;
      break;
    case "*":
      a = randomInt(2, 9);
      b = randomInt(2, 9);
      // For mixed expressions like "7 + 3 * 2", include three operands
      if (Math.random() > 0.5) {
        c = randomInt(1, 10);
        question = `What is ${c} + ${a} * ${b}?`;
        answer = c + a * b; // order of operations: multiply first
      } else {
        question = `What is ${a} * ${b}?`;
        answer = a * b;
      }
      break;
  }

  return { data: { type: "arithmetic", question }, answer: String(answer!) };
}

function generateWordLogic(): { data: Record<string, unknown>; answer: string } {
  const sets: [string[], string][] = [
    [["apple", "banana", "hammer", "orange"], "hammer"],
    [["dog", "cat", "table", "bird"], "table"],
    [["red", "blue", "green", "seven"], "seven"],
    [["car", "bus", "tree", "train"], "tree"],
    [["guitar", "piano", "drum", "book"], "book"],
    [["mercury", "venus", "mars", "spoon"], "spoon"],
    [["oxygen", "nitrogen", "helium", "pizza"], "pizza"],
    [["monday", "tuesday", "friday", "cloud"], "cloud"],
  ];

  const [words, oddOne] = pickRandom(sets);
  // Shuffle display order so the odd one isn't always in the same position
  const shuffled = [...words].sort(() => Math.random() - 0.5);

  return {
    data: { type: "word_logic", question: `Which word does not belong: ${shuffled.join(", ")}?` },
    answer: oddOne,
  };
}

function generateReverseText(): { data: Record<string, unknown>; answer: string } {
  const words = [
    "planet", "garden", "silver", "bridge", "forest",
    "winter", "summer", "rocket", "island", "castle",
    "doctor", "window", "bottle", "market", "sunset",
  ];

  const word = pickRandom(words);
  const reversed = [...word].reverse().join("");

  return {
    data: { type: "reverse_text", question: `Reverse this word: '${word}'` },
    answer: reversed,
  };
}

const generators: ChallengeGenerator[] = [generateArithmetic, generateWordLogic, generateReverseText];

// --- Public API ---

/** Generate a captcha challenge, store it in DB, and return the public payload. */
export async function generateCaptcha(): Promise<{ id: string; challenge_data: Record<string, unknown> }> {
  const generator = pickRandom(generators);
  const { data, answer } = generator();

  const answerHash = await hashAnswer(answer);
  const expiresAt = new Date(Date.now() + CAPTCHA_EXPIRY_MINUTES * 60_000);

  const row = await queryOne<{ id: string }>(
    `INSERT INTO captcha_challenges (challenge_data, answer_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [JSON.stringify(data), answerHash, expiresAt],
  );

  return { id: row!.id, challenge_data: data };
}

/** Verify a captcha answer. Deletes the challenge (single-use). Returns true if valid. */
export async function verifyCaptcha(id: string, answer: string): Promise<boolean> {
  const row = await queryOne<{ answer_hash: string; expires_at: Date }>(
    `SELECT answer_hash, expires_at FROM captcha_challenges WHERE id = $1`,
    [id],
  );

  if (!row) return false;

  // Delete regardless of outcome (single-use)
  await execute("DELETE FROM captcha_challenges WHERE id = $1", [id]);

  // Check expiry
  if (new Date() > new Date(row.expires_at)) return false;

  // Compare hashes
  const submittedHash = await hashAnswer(answer);
  return submittedHash === row.answer_hash;
}

async function hashAnswer(answer: string): Promise<string> {
  const encoded = new TextEncoder().encode(answer.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return encodeHex(hashBuffer);
}
