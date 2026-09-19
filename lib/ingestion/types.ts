import type { DocumentProcessingStatus, DocumentSourceType, ExtractionRunStatus } from "@/lib/domain/types";

export type DocumentMetadata = {
  documentId: string;
  vendorId: string;
  rfxId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  contentHash: string;
  sourceType: DocumentSourceType;
  processingStatus: DocumentProcessingStatus;
  createdAt: string;
  updatedAt: string;
};

export type SourceLocation = {
  documentId: string;
  page?: number;
  sheet?: string;
  row?: number;
  column?: number;
  cell?: string;
  line?: number;
  text?: string;
  sourceLocation: string;
  parser: string;
  contentHash: string;
};

export type ParsedCell = {
  value: string | number | boolean | null;
  location: SourceLocation;
};

export type ParsedRow = {
  rowNumber: number;
  cells: ParsedCell[];
  location: SourceLocation;
};

export type ParsedTable = {
  tableId: string;
  title?: string;
  rows: ParsedRow[];
  location: SourceLocation;
};

export type ParsedPage = {
  pageNumber: number;
  text: string;
  location: SourceLocation;
};

export type ParsedDocument = {
  documentId: string;
  contentHash: string;
  sourceType: DocumentSourceType;
  parserName: string;
  parserVersion: string;
  processingStatus: DocumentProcessingStatus;
  extractedText: string;
  pages: ParsedPage[];
  tables: ParsedTable[];
  metadata: Record<string, string | number | boolean | null>;
  sourceLocations: SourceLocation[];
  warnings: string[];
};

export type ExtractionRunRecord = {
  runId: string;
  documentId: string;
  contentHash: string;
  parserName: string;
  parserVersion: string;
  extractionMethod: "DETERMINISTIC_PARSE" | "AI_PENDING";
  provider: string | null;
  model: string | null;
  status: ExtractionRunStatus;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  resultReference: string | null;
};

export type ParserResult = {
  parsedDocument: ParsedDocument;
  extractionRun: ExtractionRunRecord;
  cacheHit: boolean;
};

export type DocumentParser = {
  name: string;
  version: string;
  supports: DocumentSourceType[];
  parse(input: {
    metadata: DocumentMetadata;
    bytes: Uint8Array;
  }): Promise<ParsedDocument>;
};
