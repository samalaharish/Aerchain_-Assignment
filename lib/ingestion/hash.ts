import { createHash } from "crypto";

export function sha256(bytes: Uint8Array | Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createParserCacheKey(input: { parserName: string; parserVersion: string; contentHash: string }): string {
  return `${input.parserName}@${input.parserVersion}:${input.contentHash}`;
}
