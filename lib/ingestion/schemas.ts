import { z } from "zod";

export const documentProcessingStatusSchema = z.enum([
  "RECEIVED",
  "CLASSIFIED",
  "PARSING",
  "PARSED",
  "EXTRACTION_REQUIRED",
  "EXTRACTED",
  "VALIDATION_FAILED",
  "FAILED",
  "REVIEW_REQUIRED"
]);

export const sourceTypeSchema = z.enum(["XLSX", "XLS", "PDF", "DOCX", "TXT", "PNG", "JPEG", "UNSUPPORTED"]);

export const documentMetadataSchema = z.object({
  documentId: z.string().min(1),
  vendorId: z.string().min(1),
  rfxId: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceType: sourceTypeSchema,
  processingStatus: documentProcessingStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const sourceLocationSchema = z.object({
  documentId: z.string().min(1),
  page: z.number().int().positive().optional(),
  sheet: z.string().optional(),
  row: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  cell: z.string().optional(),
  line: z.number().int().positive().optional(),
  text: z.string().optional(),
  sourceLocation: z.string().min(1),
  parser: z.string().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/)
});

export const parsedCellSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  location: sourceLocationSchema
});

export const parsedRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  cells: z.array(parsedCellSchema),
  location: sourceLocationSchema
});

export const parsedTableSchema = z.object({
  tableId: z.string().min(1),
  title: z.string().optional(),
  rows: z.array(parsedRowSchema),
  location: sourceLocationSchema
});

export const parsedPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string(),
  location: sourceLocationSchema
});

export const parsedDocumentSchema = z.object({
  documentId: z.string().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceType: sourceTypeSchema,
  parserName: z.string().min(1),
  parserVersion: z.string().min(1),
  processingStatus: documentProcessingStatusSchema,
  extractedText: z.string(),
  pages: z.array(parsedPageSchema),
  tables: z.array(parsedTableSchema),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  sourceLocations: z.array(sourceLocationSchema),
  warnings: z.array(z.string())
});

export const extractionRunSchema = z.object({
  runId: z.string().min(1),
  documentId: z.string().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  parserName: z.string().min(1),
  parserVersion: z.string().min(1),
  extractionMethod: z.enum(["DETERMINISTIC_PARSE", "AI_PENDING"]),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  status: z.enum(["PARSING", "PARSED", "AI_PENDING", "AI_EXTRACTING", "EXTRACTED", "VALIDATED", "VALIDATION_FAILED", "FAILED", "REVIEW_REQUIRED"]),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  error: z.string().nullable(),
  resultReference: z.string().nullable()
});
