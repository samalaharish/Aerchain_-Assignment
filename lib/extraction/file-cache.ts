import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { createExtractionCacheKey, type ExtractionCacheKeyInput, type ExtractionCacheStore } from "@/lib/extraction/cache";
import { vendorQuoteExtractionSchema, type VendorQuoteExtraction } from "@/lib/extraction/schemas";

export class FileExtractionCache implements ExtractionCacheStore {
  constructor(private readonly directory = path.join(process.cwd(), ".cache", "extractions")) {}

  async get(input: ExtractionCacheKeyInput): Promise<VendorQuoteExtraction | undefined> {
    try {
      const raw = await readFile(this.pathFor(input), "utf-8");
      return vendorQuoteExtractionSchema.parse(JSON.parse(raw).result);
    } catch (error) {
      if (isMissingFile(error)) return undefined;
      throw error;
    }
  }

  async set(input: ExtractionCacheKeyInput, value: VendorQuoteExtraction): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(
      this.pathFor(input),
      JSON.stringify(
        {
          cacheKey: createExtractionCacheKey(input),
          config: input,
          cachedAt: new Date().toISOString(),
          result: value
        },
        null,
        2
      ),
      "utf-8"
    );
  }

  private pathFor(input: ExtractionCacheKeyInput): string {
    return path.join(this.directory, `${createExtractionCacheKey(input)}.json`);
  }
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
