import { classifyDocument } from "@/lib/ingestion/classifier";
import { ParserCache } from "@/lib/ingestion/cache";
import { sha256 } from "@/lib/ingestion/hash";
import { getParserForSourceType } from "@/lib/ingestion/parsers";
import { documentMetadataSchema, extractionRunSchema, parsedDocumentSchema } from "@/lib/ingestion/schemas";
import type { DocumentProcessingStatus, ExtractionRunStatus } from "@/lib/domain/types";
import type { DocumentMetadata, ParserResult } from "@/lib/ingestion/types";

export type ProcessDocumentInput = {
  documentId: string;
  vendorId: string;
  rfxId: string;
  filename: string;
  mimeType?: string;
  bytes: Uint8Array;
  cache?: ParserCache;
  now?: string;
};

export async function processDocument(input: ProcessDocumentInput): Promise<ParserResult> {
  const now = input.now ?? new Date().toISOString();
  const contentHash = sha256(input.bytes);
  const classification = classifyDocument({ filename: input.filename, mimeType: input.mimeType, bytes: input.bytes });

  if (!classification.ok) {
    const metadata = documentMetadataSchema.parse({
      documentId: input.documentId,
      vendorId: input.vendorId,
      rfxId: input.rfxId,
      filename: input.filename,
      mimeType: classification.normalizedMimeType,
      fileSize: input.bytes.byteLength,
      contentHash,
      sourceType: "UNSUPPORTED",
      processingStatus: "FAILED",
      createdAt: now,
      updatedAt: now
    });

    const parsedDocument = parsedDocumentSchema.parse({
      documentId: metadata.documentId,
      contentHash,
      sourceType: "UNSUPPORTED",
      parserName: "unsupported",
      parserVersion: "v1",
      processingStatus: "FAILED",
      extractedText: "",
      pages: [],
      tables: [],
      metadata: { error: classification.error },
      sourceLocations: [],
      warnings: classification.warnings
    });

    return {
      parsedDocument,
      extractionRun: extractionRunSchema.parse(runRecord(metadata, "unsupported", "v1", "FAILED", now, classification.error, null)),
      cacheHit: false
    };
  }

  const parser = getParserForSourceType(classification.sourceType);
  const metadata: DocumentMetadata = documentMetadataSchema.parse({
    documentId: input.documentId,
    vendorId: input.vendorId,
    rfxId: input.rfxId,
    filename: input.filename,
    mimeType: classification.normalizedMimeType,
    fileSize: input.bytes.byteLength,
    contentHash,
    sourceType: classification.sourceType,
    processingStatus: "CLASSIFIED",
    createdAt: now,
    updatedAt: now
  });

  if (!parser) {
    const parsedDocument = parsedDocumentSchema.parse({
      documentId: metadata.documentId,
      contentHash,
      sourceType: metadata.sourceType,
      parserName: "unsupported",
      parserVersion: "v1",
      processingStatus: "EXTRACTION_REQUIRED",
      extractedText: "",
      pages: [],
      tables: [],
      metadata: { reason: "No deterministic parser exists for this source type." },
      sourceLocations: [],
      warnings: classification.warnings
    });

    return {
      parsedDocument,
      extractionRun: extractionRunSchema.parse(runRecord(metadata, "unsupported", "v1", "AI_PENDING", now, null, null)),
      cacheHit: false
    };
  }

  const cached = input.cache?.get({ parserName: parser.name, parserVersion: parser.version, contentHash });
  if (cached) {
    return {
      parsedDocument: cached,
      extractionRun: extractionRunSchema.parse(runRecord(metadata, parser.name, parser.version, statusFor(cached.processingStatus), now, null, `cache:${parser.name}:${contentHash}`)),
      cacheHit: true
    };
  }

  const parsed = parsedDocumentSchema.parse(await parser.parse({ metadata, bytes: input.bytes }));
  const parsedDocument = parsedDocumentSchema.parse({
    ...parsed,
    warnings: [...classification.warnings, ...parsed.warnings]
  });
  input.cache?.registerDocumentHash(contentHash);
  input.cache?.set({ parserName: parser.name, parserVersion: parser.version, contentHash, parsedDocument });

  return {
    parsedDocument,
    extractionRun: extractionRunSchema.parse(runRecord(metadata, parser.name, parser.version, statusFor(parsedDocument.processingStatus), now, null, `parsed:${parser.name}:${contentHash}`)),
    cacheHit: false
  };
}

function statusFor(processingStatus: DocumentProcessingStatus): ExtractionRunStatus {
  if (processingStatus === "PARSED") return "PARSED";
  if (processingStatus === "EXTRACTION_REQUIRED") return "AI_PENDING";
  if (processingStatus === "VALIDATION_FAILED") return "VALIDATION_FAILED";
  if (processingStatus === "REVIEW_REQUIRED") return "REVIEW_REQUIRED";
  if (processingStatus === "FAILED") return "FAILED";
  return "PARSING";
}

function runRecord(
  metadata: DocumentMetadata,
  parserName: string,
  parserVersion: string,
  status: ExtractionRunStatus,
  now: string,
  error: string | null,
  resultReference: string | null
) {
  return {
    runId: `run-${metadata.documentId}-${parserName}-${metadata.contentHash.slice(0, 12)}`,
    documentId: metadata.documentId,
    contentHash: metadata.contentHash,
    parserName,
    parserVersion,
    extractionMethod: status === "AI_PENDING" ? "AI_PENDING" : "DETERMINISTIC_PARSE",
    provider: null,
    model: null,
    status,
    startedAt: now,
    completedAt: status === "PARSING" ? null : now,
    error,
    resultReference
  };
}
