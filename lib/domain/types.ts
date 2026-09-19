export type Currency = "INR" | "USD" | "EUR";
export type Unit = "piece" | "hundred_pieces" | "box" | "carton" | "bundle" | "kg" | "sqm" | "unknown";
export type QualityStatus = "PASS" | "FAIL" | "INCOMPLETE" | "NOT_EVALUATED";
export type RfxStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type VendorResponseStatus = "RECEIVED" | "PROCESSED" | "NEEDS_REVIEW" | "FAILED";
export type VendorResponseFormat = "EXCEL" | "PDF" | "DOCX_EMAIL" | "AMBIGUOUS_TEXT" | "SCANNED_IMAGE";
export type NormalizationStatus = "NORMALIZED" | "UNRESOLVED";
export type ExceptionSeverity = "LOW" | "MEDIUM" | "HIGH";
export type DocumentSourceType = "XLSX" | "XLS" | "PDF" | "DOCX" | "TXT" | "PNG" | "JPEG" | "UNSUPPORTED";
export type DocumentProcessingStatus =
  | "RECEIVED"
  | "CLASSIFIED"
  | "PARSING"
  | "PARSED"
  | "EXTRACTION_REQUIRED"
  | "EXTRACTED"
  | "VALIDATION_FAILED"
  | "FAILED"
  | "REVIEW_REQUIRED";
export type ExtractionRunStatus =
  | "PARSING"
  | "PARSED"
  | "AI_PENDING"
  | "AI_EXTRACTING"
  | "EXTRACTED"
  | "VALIDATED"
  | "VALIDATION_FAILED"
  | "FAILED"
  | "REVIEW_REQUIRED";
export type ExtractionMethod = "DETERMINISTIC_PARSE" | "AI_PENDING" | "SEEDED_FIXTURE";

export type ExceptionCode =
  | "MISSING_QUOTE"
  | "MISSING_PRICE"
  | "MISSING_CURRENCY"
  | "AMBIGUOUS_CURRENCY"
  | "INVALID_PRICE"
  | "MISSING_QUANTITY"
  | "UNKNOWN_UNIT"
  | "AMBIGUOUS_UNIT"
  | "UNKNOWN_PACK_SIZE"
  | "UNIT_CONVERSION_REQUIRED"
  | "MISSING_FREIGHT"
  | "AMBIGUOUS_FREIGHT"
  | "FREIGHT_AMBIGUOUS"
  | "MISSING_LEAD_TIME"
  | "QUALITY_FAILURE"
  | "INCOMPLETE_RESPONSE"
  | "UNMAPPED_LINE_ITEM"
  | "AMBIGUOUS_LINE_MATCH"
  | "INSUFFICIENT_EVIDENCE";

export type Rfx = {
  id: string;
  title: string;
  category: string;
  description: string;
  baseCurrency: Currency;
  status: RfxStatus;
  createdAt: string;
  dueAt: string;
};

export type RfxLineItem = {
  id: string;
  rfxId: string;
  lineNumber: number;
  sku: string;
  description: string;
  specification: string;
  quantity: number;
  unit: Unit;
  requiredBy: string;
};

export type Vendor = {
  id: string;
  code: string;
  name: string;
  location: string;
  qualityStatus: QualityStatus;
};

export type VendorResponse = {
  id: string;
  vendorId: string;
  rfxId: string;
  format: VendorResponseFormat;
  status: VendorResponseStatus;
  completeness: "COMPLETE" | "PARTIAL" | "AMBIGUOUS";
  documentId: string;
  messinessNotes: string[];
  receivedAt: string;
};

export type Document = {
  id: string;
  vendorId: string;
  rfxId: string;
  vendorResponseId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  contentHash: string;
  sourceType: DocumentSourceType;
  processingStatus: DocumentProcessingStatus;
  sourceKind: VendorResponseFormat;
  sha256: string;
  storagePath: string;
  isSeededFixture: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Evidence = {
  id: string;
  documentId: string;
  quoteLineItemId?: string;
  sourceLabel: string;
  sourceText: string;
  extractionMethod: "SEEDED_FIXTURE" | "PARSER" | "AI";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
};

export type FreightTerm =
  | { kind: "included" }
  | { kind: "excluded"; amount: number; currency: Currency; perUnit: Unit }
  | { kind: "missing" }
  | { kind: "ambiguous"; note: string };

export type QuoteLineItem = {
  id: string;
  vendorId: string;
  vendorResponseId: string;
  rfxLineItemId: string | null;
  originalDescription: string;
  quotedQuantity: number | null;
  originalPrice: number | null;
  currency: Currency | null;
  unit: Unit;
  packSize: number | null;
  freight: FreightTerm;
  leadTimeDays: number | null;
  qualityStatus: QualityStatus;
  sourceDocumentId: string;
  normalizationStatus: NormalizationStatus;
  normalizedUnitPrice: number | null;
  normalizedCurrency: Currency | null;
  exceptionStatus: "NONE" | "HAS_EXCEPTIONS";
};

export type QuestionnaireAnswer = {
  id: string;
  vendorId: string;
  questionCode: string;
  question: string;
  answer: string | null;
  status: QualityStatus;
};

export type ProcurementException = {
  id: string;
  code: ExceptionCode;
  severity: ExceptionSeverity;
  message: string;
  vendorId?: string;
  quoteLineItemId?: string;
  rfxLineItemId?: string;
  evidenceId?: string;
  createdAt: string;
};

export type Scenario = {
  id: string;
  name: string;
  goal: "LOWEST_TOTAL_COST" | "LOWEST_QUALITY_APPROVED_COST" | "SPLIT_AWARD";
  constraints: string[];
};

export type AnalysisRun = {
  id: string;
  scenarioId: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  createdAt: string;
};

export type ExtractionRun = {
  id: string;
  documentId: string;
  contentHash: string;
  parserName: string;
  parserVersion: string;
  extractionMethod: ExtractionMethod;
  provider: string | null;
  model: string | null;
  status: ExtractionRunStatus;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  resultReference: string | null;
};

export type ProcurementEvent = {
  rfx: Rfx;
  lineItems: RfxLineItem[];
  vendors: Vendor[];
  responses: VendorResponse[];
  documents: Document[];
  quoteLineItems: QuoteLineItem[];
  questionnaireAnswers: QuestionnaireAnswer[];
  evidence: Evidence[];
  scenarios: Scenario[];
  analysisRuns: AnalysisRun[];
  extractionRuns: ExtractionRun[];
};
