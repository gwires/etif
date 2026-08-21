import { describe, it } from "jsr:@std/testing/bdd";
import { assert } from "jsr:@std/assert";
import fc from "npm:fast-check@3";
import { extractUrls } from "../api/captures/extract_urls.ts";

describe("extractUrls properties", () => {
  it("every extracted URL is a substring of the source text", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const urls = extractUrls(text);
        for (const url of urls) {
          assert(text.includes(url), `Extracted URL "${url}" not found in source text`);
        }
        return true;
      }),
      { numRuns: 500 },
    );
  });

  it("every extracted URL starts with http:// or https://", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const urls = extractUrls(text);
        for (const url of urls) {
          assert(
            url.startsWith("http://") || url.startsWith("https://"),
            `URL "${url}" does not start with http(s)://`,
          );
        }
        return true;
      }),
      { numRuns: 500 },
    );
  });

  it("no duplicates in output", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (texts) => {
        const urls = extractUrls(...texts);
        assertEquals(urls.length, new Set(urls).size);
        return true;
      }),
      { numRuns: 500 },
    );
  });
});

// Need this import for the third test
import { assertEquals } from "jsr:@std/assert";
