import { createParserCacheKey } from "@/lib/ingestion/hash";
import type { ParsedDocument } from "@/lib/ingestion/types";

export class ParserCache {
  private readonly parsedDocuments = new Map<string, ParsedDocument>();
  private readonly hashes = new Set<string>();

  registerDocumentHash(contentHash: string): boolean {
    const duplicate = this.hashes.has(contentHash);
    this.hashes.add(contentHash);
    return duplicate;
  }

  isDuplicate(contentHash: string): boolean {
    return this.hashes.has(contentHash);
  }

  get(input: { parserName: string; parserVersion: string; contentHash: string }): ParsedDocument | undefined {
    return this.parsedDocuments.get(createParserCacheKey(input));
  }

  set(input: { parserName: string; parserVersion: string; contentHash: string; parsedDocument: ParsedDocument }): void {
    this.parsedDocuments.set(createParserCacheKey(input), input.parsedDocument);
  }
}
