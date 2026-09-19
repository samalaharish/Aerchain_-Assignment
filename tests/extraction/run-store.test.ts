import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { createRunId, FileExtractionRunStore, type ExtractionRunLog } from "@/lib/extraction/run-store";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("file-backed extraction run store", () => {
  it("persists provider/model/status/timing/usage metadata", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "aerchain-extraction-runs-"));
    tempDirs.push(dir);
    const store = new FileExtractionRunStore(dir);
    const run: ExtractionRunLog = {
      runId: createRunId({ documentId: "doc-d", cacheKey: "abcdef1234567890", startedAt: "2026-09-19T12:00:00.000Z", status: "EXTRACTED" }),
      documentId: "doc-d",
      vendorId: "vendor-d",
      cacheKey: "abcdef1234567890",
      path: "AI_PROVIDER",
      status: "EXTRACTED",
      reason: "Ambiguous supplier wording requires semantic interpretation.",
      cacheHit: false,
      provider: "gemini",
      model: "gemini-2.0-flash",
      requestId: "request-1",
      latencyMs: 1234,
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      error: null,
      startedAt: "2026-09-19T12:00:00.000Z",
      completedAt: "2026-09-19T12:00:01.234Z"
    };

    await store.record(run);
    const persisted = JSON.parse(await readFile(path.join(dir, `${run.runId}.json`), "utf-8")) as ExtractionRunLog;

    expect(persisted.provider).toBe("gemini");
    expect(persisted.model).toBe("gemini-2.0-flash");
    expect(persisted.totalTokens).toBe(150);
    expect(persisted.status).toBe("EXTRACTED");
  });
});
