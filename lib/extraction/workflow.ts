import { readFile } from "fs/promises";
import path from "path";
import { procurementEvent } from "@/lib/fixtures/procurement-event";
import { ParserCache } from "@/lib/ingestion/cache";
import { processDocument } from "@/lib/ingestion/processor";
import type { ParsedDocument } from "@/lib/ingestion/types";
import { createExtractionCacheKey, EXTRACTION_PROMPT_VERSION, EXTRACTION_SCHEMA_VERSION, MemoryExtractionCache, type ExtractionCacheStore } from "@/lib/extraction/cache";
import { extractStructuredQuoteDeterministically } from "@/lib/extraction/deterministic-extractor";
import { decideExtractionPath } from "@/lib/extraction/escalation";
import { selectExtractionProvider } from "@/lib/extraction/config";
import { FileExtractionCache } from "@/lib/extraction/file-cache";
import { createRunId, FileExtractionRunStore, type ExtractionRunStore } from "@/lib/extraction/run-store";
import { createSupabaseExtractionCache, createSupabaseExtractionRunStore, persistExtractionResultToSupabase } from "@/lib/extraction/supabase-persistence";
import type { QuoteExtractionProvider } from "@/lib/extraction/provider";
import type { VendorQuoteExtraction } from "@/lib/extraction/schemas";
import { validateVendorQuoteExtraction } from "@/lib/extraction/schemas";

export type ExtractionWorkflowResult = {
  documentId: string;
  vendorId: string;
  status: "EXTRACTED" | "AI_PENDING" | "FAILED" | "REVIEW_REQUIRED";
  path: "DETERMINISTIC" | "AI_PROVIDER";
  reason: string;
  cacheHit: boolean;
  cacheKey: string;
  extraction: VendorQuoteExtraction | null;
  run: {
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
};

const fixtureMap: Record<string, { vendorId: string; filename: string; mimeType: string }> = {
  "doc-a": { vendorId: "vendor-a", filename: "vendor-a.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  "doc-b": { vendorId: "vendor-b", filename: "vendor-b.pdf", mimeType: "application/pdf" },
  "doc-c": { vendorId: "vendor-c", filename: "vendor-c.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  "doc-d": { vendorId: "vendor-d", filename: "vendor-d.txt", mimeType: "text/plain" },
  "doc-e": { vendorId: "vendor-e", filename: "vendor-e.png", mimeType: "image/png" }
};

const processCache = new ParserCache();
const defaultExtractionCache = new FileExtractionCache();
const defaultRunStore = new FileExtractionRunStore();

export async function runFixtureExtractionWorkflow(
  documentId: string,
  provider?: QuoteExtractionProvider,
  cache?: ExtractionCacheStore,
  runStore?: ExtractionRunStore
): Promise<ExtractionWorkflowResult> {
  const fixture = fixtureMap[documentId];
  if (!fixture) {
    throw new Error(`Unknown fixture document: ${documentId}`);
  }

  const vendor = procurementEvent.vendors.find((item) => item.id === fixture.vendorId);
  if (!vendor) {
    throw new Error(`Unknown vendor for fixture document: ${documentId}`);
  }

  const bytes = await readFile(path.join(process.cwd(), "fixtures", "vendor-responses", fixture.filename));
  const parsedResult = await processDocument({
    documentId,
    vendorId: vendor.id,
    rfxId: procurementEvent.rfx.id,
    filename: fixture.filename,
    mimeType: fixture.mimeType,
    bytes,
    cache: processCache,
    now: new Date().toISOString()
  });

  return extractFromParsedDocument({
    parsedDocument: parsedResult.parsedDocument,
    documentBytes: bytes,
    mimeType: fixture.mimeType,
    vendorId: vendor.id,
    provider,
    cache,
    runStore
  });
}

export async function extractFromParsedDocument(input: {
  parsedDocument: ParsedDocument;
  documentBytes?: Uint8Array;
  mimeType?: string;
  vendorId: string;
  provider?: QuoteExtractionProvider;
  cache?: ExtractionCacheStore;
  runStore?: ExtractionRunStore;
}): Promise<ExtractionWorkflowResult> {
  const startedAt = new Date().toISOString();
  const vendor = procurementEvent.vendors.find((item) => item.id === input.vendorId);
  if (!vendor) throw new Error(`Unknown vendor: ${input.vendorId}`);

  const decision = decideExtractionPath(input.parsedDocument);
  const validLineIds = new Set(procurementEvent.lineItems.map((line) => line.id));

  if (decision.path === "DETERMINISTIC") {
    const completedAt = new Date().toISOString();
    const extraction = validateVendorQuoteExtraction(
      extractStructuredQuoteDeterministically({ event: procurementEvent, vendor, parsedDocument: input.parsedDocument }),
      validLineIds
    );
    try {
      await persistExtractionResultToSupabase({
        provider: "deterministic",
        model: "parser-first",
        promptVersion: "deterministic-parse",
        schemaVersion: EXTRACTION_SCHEMA_VERSION,
        contentHash: input.parsedDocument.contentHash,
        rfxVersion: procurementEvent.rfx.id
      }, extraction);
    } catch (error) {
      console.warn("Supabase deterministic extraction persistence failed.", error);
    }
    return recordAndReturn(input.runStore, {
      documentId: input.parsedDocument.documentId,
      vendorId: vendor.id,
      status: "EXTRACTED",
      path: "DETERMINISTIC",
      reason: decision.reason,
      cacheHit: false,
      cacheKey: "deterministic",
      extraction,
      run: {
        provider: null,
        model: null,
        requestId: null,
        latencyMs: 0,
        error: null,
        startedAt,
        completedAt
      }
    });
  }

  const providerSelection = input.provider
    ? {
        provider: input.provider,
        providerName: input.provider.provider,
        model: input.provider.model,
        configurationError: null
      }
    : selectExtractionProvider();
  const aiProvider = providerSelection.provider;
  const providerName = providerSelection.providerName;
  const model = providerSelection.model;
  const cacheInput = {
    provider: providerName,
    model,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    contentHash: input.parsedDocument.contentHash,
    rfxVersion: procurementEvent.rfx.id
  };
  const cacheKey = createExtractionCacheKey(cacheInput);
  const cacheStore = input.cache ?? (input.provider ? new MemoryExtractionCache() : createSupabaseExtractionCache() ?? defaultExtractionCache);
  const runStore = input.runStore ?? createSupabaseExtractionRunStore() ?? defaultRunStore;
  const cached = await cacheStore.get(cacheInput);
  if (cached) {
    return recordAndReturn(runStore, {
      documentId: input.parsedDocument.documentId,
      vendorId: vendor.id,
      status: "EXTRACTED",
      path: "AI_PROVIDER",
      reason: `${decision.reason} Cached AI extraction reused.`,
      cacheHit: true,
      cacheKey,
      extraction: cached,
      run: {
        provider: providerName,
        model,
        requestId: null,
        latencyMs: 0,
        error: null,
        startedAt,
        completedAt: new Date().toISOString()
      }
    });
  }

  if (!aiProvider) {
    const configurationError = providerSelection.configurationError ?? "Extraction provider is not configured.";
    return recordAndReturn(runStore, {
      documentId: input.parsedDocument.documentId,
      vendorId: vendor.id,
      status: "AI_PENDING",
      path: "AI_PROVIDER",
      reason: `${decision.reason} ${configurationError}`,
      cacheHit: false,
      cacheKey,
      extraction: null,
      run: {
        provider: providerName,
        model,
        requestId: null,
        latencyMs: null,
        error: configurationError,
        startedAt,
        completedAt: null
      }
    });
  }

  try {
    const result = await aiProvider.extractQuote({
      event: procurementEvent,
      vendor,
      parsedDocument: input.parsedDocument,
      documentBytes: input.documentBytes,
      mimeType: input.mimeType
    });
    await cacheStore.set(cacheInput, result.extraction);

    return recordAndReturn(runStore, {
      documentId: input.parsedDocument.documentId,
      vendorId: vendor.id,
      status: "EXTRACTED",
      path: "AI_PROVIDER",
      reason: decision.reason,
      cacheHit: false,
      cacheKey,
      extraction: result.extraction,
      run: {
        provider: aiProvider.provider,
        model: aiProvider.model,
        requestId: result.requestId,
        latencyMs: result.latencyMs,
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
        totalTokens: result.usage?.totalTokens,
        error: null,
        startedAt,
        completedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return recordAndReturn(runStore, {
      documentId: input.parsedDocument.documentId,
      vendorId: vendor.id,
      status: "FAILED",
      path: "AI_PROVIDER",
      reason: decision.reason,
      cacheHit: false,
      cacheKey,
      extraction: null,
      run: {
        provider: providerName,
        model,
        requestId: null,
        latencyMs: null,
        error: error instanceof Error ? error.message : "Unknown extraction failure.",
        startedAt,
        completedAt: new Date().toISOString()
      }
    });
  }
}

async function recordAndReturn(runStore: ExtractionRunStore | undefined, result: ExtractionWorkflowResult): Promise<ExtractionWorkflowResult> {
  const store = runStore ?? defaultRunStore;
  const runLog = {
    runId: createRunId({
      documentId: result.documentId,
      cacheKey: result.cacheKey,
      startedAt: result.run.startedAt,
      status: result.status
    }),
    documentId: result.documentId,
    vendorId: result.vendorId,
    cacheKey: result.cacheKey,
    path: result.path,
    status: result.status,
    reason: result.reason,
    cacheHit: result.cacheHit,
    provider: result.run.provider,
    model: result.run.model,
    requestId: result.run.requestId,
    latencyMs: result.run.latencyMs,
    promptTokens: result.run.promptTokens,
    completionTokens: result.run.completionTokens,
    totalTokens: result.run.totalTokens,
    error: result.run.error,
    startedAt: result.run.startedAt,
    completedAt: result.run.completedAt
  };
  try {
    await store.record(runLog);
  } catch (error) {
    if (runStore) throw error;
    console.warn("Primary extraction run persistence failed; using local fallback.", error);
    await defaultRunStore.record(runLog);
  }
  return result;
}
