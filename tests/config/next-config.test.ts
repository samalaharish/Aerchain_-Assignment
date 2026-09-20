import { describe, expect, it } from "vitest";
import path from "node:path";
import { pathToFileURL } from "node:url";

type NextConfigWithTracing = {
  experimental?: {
    outputFileTracingIncludes?: Record<string, string[]>;
  };
};

describe("Next production file tracing", () => {
  it("bundles vendor response fixtures for response and extraction server routes", async () => {
    const configUrl = pathToFileURL(path.join(process.cwd(), "next.config.mjs")).href;
    const { default: nextConfig } = (await import(configUrl)) as {
      default: NextConfigWithTracing;
    };

    const includes = nextConfig.experimental?.outputFileTracingIncludes;

    expect(includes?.["/responses"]).toContain("./fixtures/vendor-responses/**/*");
    expect(includes?.["/responses/[documentId]"]).toContain("./fixtures/vendor-responses/**/*");
    expect(includes?.["/api/extractions/[documentId]/run"]).toContain("./fixtures/vendor-responses/**/*");
  });
});
