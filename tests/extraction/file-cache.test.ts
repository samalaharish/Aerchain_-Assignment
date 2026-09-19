import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { EXTRACTION_PROMPT_VERSION, EXTRACTION_SCHEMA_VERSION, type ExtractionCacheKeyInput } from "@/lib/extraction/cache";
import { FileExtractionCache } from "@/lib/extraction/file-cache";
import { sha256 } from "@/lib/ingestion/hash";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("file-backed extraction cache", () => {
  it("persists validated extraction results by cache key", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "aerchain-extraction-cache-"));
    tempDirs.push(dir);
    const cache = new FileExtractionCache(dir);
    const key = cacheKey(sha256("doc"));
    const extraction = {
      vendorId: "vendor-a",
      vendorName: "Alpha Packwell",
      documentId: "doc-a",
      extractionMethod: "DETERMINISTIC" as const,
      provider: null,
      model: null,
      lineItems: [],
      qualityResponses: [],
      commercialTerms: [],
      extractionWarnings: [],
      overallConfidence: "HIGH" as const
    };

    await cache.set(key, extraction);
    await expect(cache.get(key)).resolves.toEqual(extraction);
  });

  it("misses when content hash changes", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "aerchain-extraction-cache-"));
    tempDirs.push(dir);
    const cache = new FileExtractionCache(dir);
    await cache.set(cacheKey(sha256("doc-a")), {
      vendorId: "vendor-a",
      vendorName: "Alpha Packwell",
      documentId: "doc-a",
      extractionMethod: "DETERMINISTIC",
      provider: null,
      model: null,
      lineItems: [],
      qualityResponses: [],
      commercialTerms: [],
      extractionWarnings: [],
      overallConfidence: "HIGH"
    });

    await expect(cache.get(cacheKey(sha256("doc-b")))).resolves.toBeUndefined();
  });
});

function cacheKey(contentHash: string): ExtractionCacheKeyInput {
  return {
    provider: "gemini",
    model: "gemini-2.0-flash",
    promptVersion: EXTRACTION_PROMPT_VERSION,
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    contentHash,
    rfxVersion: "rfx-corrugated-2026"
  };
}
