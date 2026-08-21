import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { extractUrls } from "../api/captures/extract_urls.ts";

describe("extractUrls", () => {
  it("extracts bare URLs", () => {
    const urls = extractUrls("Check https://example.com and http://test.org/path");
    assertEquals(urls, ["https://example.com", "http://test.org/path"]);
  });

  it("extracts markdown links", () => {
    const urls = extractUrls("[Google](https://google.com) and [Test](http://test.org)");
    assertEquals(urls, ["https://google.com", "http://test.org"]);
  });

  it("extracts autolinks", () => {
    const urls = extractUrls("See <https://auto.link> for info");
    assertEquals(urls, ["https://auto.link"]);
  });

  it("deduplicates across formats", () => {
    const text = "https://dup.com [link](https://dup.com) <https://dup.com>";
    assertEquals(extractUrls(text), ["https://dup.com"]);
  });

  it("handles null and undefined inputs", () => {
    assertEquals(extractUrls(null, undefined, ""), []);
  });

  it("extracts from multiple fields", () => {
    const urls = extractUrls("https://a.com", "https://b.com", "https://a.com");
    assertEquals(urls, ["https://a.com", "https://b.com"]);
  });

  it("does not double-count bare URLs inside markdown links", () => {
    const text = "[click](https://inside.com)";
    assertEquals(extractUrls(text), ["https://inside.com"]);
  });

  it("preserves order of first appearance", () => {
    const text = "https://third.com https://first.com https://second.com";
    assertEquals(extractUrls(text), ["https://third.com", "https://first.com", "https://second.com"]);
  });

  it("handles URLs with paths and query strings", () => {
    const urls = extractUrls("https://example.com/path?q=1&b=2#hash");
    assertEquals(urls, ["https://example.com/path?q=1&b=2#hash"]);
  });

  it("returns empty for no URLs", () => {
    assertEquals(extractUrls("no urls here just plain text"), []);
  });
});
