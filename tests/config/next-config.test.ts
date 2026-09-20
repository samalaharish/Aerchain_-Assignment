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

  it("bundles the PDF.js worker required by server-side PDF parsing", async () => {
    const configUrl = pathToFileURL(path.join(process.cwd(), "next.config.mjs")).href;
    const { default: nextConfig } = (await import(configUrl)) as {
      default: NextConfigWithTracing;
    };

    const includes = nextConfig.experimental?.outputFileTracingIncludes;
    const expectedWorkerGlob = "./node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs";

    expect(includes?.["/dashboard"]).toContain(expectedWorkerGlob);
    expect(includes?.["/responses"]).toContain(expectedWorkerGlob);
    expect(includes?.["/comparison"]).toContain(expectedWorkerGlob);
    expect(includes?.["/api/extractions/[documentId]/run"]).toContain(expectedWorkerGlob);
  });
});
