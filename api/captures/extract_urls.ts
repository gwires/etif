// Extract URLs from markdown text.
// Handles: [text](url), bare https?:// URLs, <url> autolinks.
// Returns deduplicated array of URL strings.

const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;
const AUTOLINK = /<(https?:\/\/[^>\s]+)>/g;
const BARE_URL = /https?:\/\/[^\s)<>\]]+/g;

export function extractUrls(...texts: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const text of texts) {
    if (!text) continue;
    for (const url of parseText(text)) {
      if (!seen.has(url)) {
        seen.add(url);
        result.push(url);
      }
    }
  }

  return result;
}

function parseText(text: string): string[] {
  const urls: string[] = [];

  // Markdown links: [text](url)
  for (const m of text.matchAll(MARKDOWN_LINK)) {
    urls.push(m[2]);
  }

  // Autolinks: <url>
  for (const m of text.matchAll(AUTOLINK)) {
    urls.push(m[1]);
  }

  // Bare URLs — but skip those already captured inside markdown links or autolinks
  // Build a set of positions covered by the above matches
  const covered = new Set<number>();
  for (const m of text.matchAll(MARKDOWN_LINK)) {
    for (let i = m.index!; i < m.index! + m[0].length; i++) covered.add(i);
  }
  for (const m of text.matchAll(AUTOLINK)) {
    for (let i = m.index!; i < m.index! + m[0].length; i++) covered.add(i);
  }

  for (const m of text.matchAll(BARE_URL)) {
    if (!covered.has(m.index!)) {
      urls.push(m[0]);
    }
  }

  return urls;
}
