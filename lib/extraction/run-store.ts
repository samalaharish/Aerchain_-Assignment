import { mkdir, writeFile } from "fs/promises";
import path from "path";

export type ExtractionRunLog = {
  runId: string;
  documentId: string;
  vendorId: string;
  cacheKey: string;
  path: "DETERMINISTIC" | "AI_PROVIDER";
  status: "EXTRACTED" | "AI_PENDING" | "FAILED" | "REVIEW_REQUIRED";
  reason: string;
  cacheHit: boolean;
  provider: string | null;
  model: string | null;
  requestId: string | null;
  latencyMs: number | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type ExtractionRunStore = {
  record(run: ExtractionRunLog): Promise<void>;
};

export class MemoryExtractionRunStore implements ExtractionRunStore {
  readonly runs: ExtractionRunLog[] = [];

  async record(run: ExtractionRunLog): Promise<void> {
    this.runs.push(run);
  }
}

export class FileExtractionRunStore implements ExtractionRunStore {
  constructor(private readonly directory = path.join(process.cwd(), ".cache", "extraction-runs")) {}

  async record(run: ExtractionRunLog): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(path.join(this.directory, `${run.runId}.json`), JSON.stringify(run, null, 2), "utf-8");
  }
}

export function createRunId(input: { documentId: string; cacheKey: string; startedAt: string; status: string }): string {
  const timestamp = input.startedAt.replace(/[^0-9]/g, "").slice(0, 14);
  return `run-${input.documentId}-${timestamp}-${input.status.toLowerCase()}-${input.cacheKey.slice(0, 12)}`;
}
