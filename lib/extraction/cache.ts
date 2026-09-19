import { sha256 } from "@/lib/ingestion/hash";
import type { VendorQuoteExtraction } from "@/lib/extraction/schemas";

export type ExtractionCacheKeyInput = {
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  contentHash: string;
  rfxVersion: string;
};

export class ExtractionCache {
  private readonly cache = new Map<string, VendorQuoteExtraction>();

  get(input: ExtractionCacheKeyInput): VendorQuoteExtraction | undefined {
    return this.cache.get(createExtractionCacheKey(input));
  }

  set(input: ExtractionCacheKeyInput, value: VendorQuoteExtraction): void {
    this.cache.set(createExtractionCacheKey(input), value);
  }
}

export type ExtractionCacheStore = {
  get(input: ExtractionCacheKeyInput): Promise<VendorQuoteExtraction | undefined>;
  set(input: ExtractionCacheKeyInput, value: VendorQuoteExtraction): Promise<void>;
};

export class MemoryExtractionCache implements ExtractionCacheStore {
  private readonly cache = new ExtractionCache();

  async get(input: ExtractionCacheKeyInput): Promise<VendorQuoteExtraction | undefined> {
    return this.cache.get(input);
  }

  async set(input: ExtractionCacheKeyInput, value: VendorQuoteExtraction): Promise<void> {
    this.cache.set(input, value);
  }
}

export function createExtractionCacheKey(input: ExtractionCacheKeyInput): string {
  return sha256(JSON.stringify(input));
}

export const EXTRACTION_PROMPT_VERSION = "procurement-extraction-prompt-v2";
export const EXTRACTION_SCHEMA_VERSION = "vendor-quote-schema-v1";
