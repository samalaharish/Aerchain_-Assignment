import { z } from "zod";

export const extractionConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const quoteLineStatusSchema = z.enum(["QUOTED", "NOT_QUOTED", "AMBIGUOUS"]);

export const extractionEvidenceSchema = z.object({
  documentId: z.string().min(1),
  text: z.string().min(1),
  page: z.number().int().positive().optional(),
  sheet: z.string().optional(),
  row: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  cell: z.string().optional(),
  line: z.number().int().positive().optional(),
  sourceLocation: z.string().min(1),
  parser: z.string().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/)
});

export const extractedFreightSchema = z.object({
  kind: z.enum(["included", "excluded", "missing", "ambiguous"]),
  amount: z.number().positive().nullable(),
  currency: z.enum(["INR", "USD", "EUR"]).nullable(),
  unit: z.string().nullable(),
  notes: z.string().nullable(),
  evidence: z.array(extractionEvidenceSchema)
});

export const extractedQuoteLineSchema = z.object({
  rfxLineId: z.string().min(1),
  status: quoteLineStatusSchema,
  vendorDescription: z.string().nullable(),
  quotedQuantity: z.number().positive().nullable(),
  quotedUnit: z.string().nullable(),
  unitPrice: z.number().positive().nullable(),
  currency: z.enum(["INR", "USD", "EUR"]).nullable(),
  leadTimeDays: z.number().int().positive().nullable(),
  freight: extractedFreightSchema,
  notes: z.string().nullable(),
  confidence: extractionConfidenceSchema,
  evidence: z.array(extractionEvidenceSchema),
  warnings: z.array(z.string())
});

export const qualityResponseSchema = z.object({
  questionCode: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().nullable(),
  status: z.enum(["PASS", "FAIL", "INCOMPLETE", "NOT_EVALUATED"]),
  confidence: extractionConfidenceSchema,
  evidence: z.array(extractionEvidenceSchema)
});

export const commercialTermSchema = z.object({
  type: z.enum(["payment_terms", "validity", "minimum_order_quantity", "shipping", "other"]),
  value: z.string().min(1),
  confidence: extractionConfidenceSchema,
  evidence: z.array(extractionEvidenceSchema)
});

export const vendorQuoteExtractionSchema = z.object({
  vendorId: z.string().min(1),
  vendorName: z.string().min(1),
  documentId: z.string().min(1),
  extractionMethod: z.enum(["DETERMINISTIC", "AI_GEMINI", "AI_OPENAI", "AI_DEMO"]),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  lineItems: z.array(extractedQuoteLineSchema),
  qualityResponses: z.array(qualityResponseSchema),
  commercialTerms: z.array(commercialTermSchema),
  extractionWarnings: z.array(z.string()),
  overallConfidence: extractionConfidenceSchema
});

export type VendorQuoteExtraction = z.infer<typeof vendorQuoteExtractionSchema>;
export type ExtractedQuoteLine = z.infer<typeof extractedQuoteLineSchema>;
export type ExtractionEvidence = z.infer<typeof extractionEvidenceSchema>;

export function validateVendorQuoteExtraction(input: unknown, validRfxLineIds: Set<string>) {
  const parsed = vendorQuoteExtractionSchema.parse(input);
  const unknownLine = parsed.lineItems.find((line) => !validRfxLineIds.has(line.rfxLineId));
  if (unknownLine) {
    throw new Error(`Unknown RFx line ID in extraction result: ${unknownLine.rfxLineId}`);
  }

  return parsed;
}
