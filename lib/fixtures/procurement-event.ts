import type { Document, Evidence, ProcurementEvent, QuestionnaireAnswer, QuoteLineItem, RfxLineItem, Vendor, VendorResponse } from "@/lib/domain/types";

const rfxId = "rfx-corrugated-2026";

const descriptions = [
  "3-ply brown shipping carton 200x150x120 mm",
  "3-ply brown shipping carton 250x180x150 mm",
  "3-ply brown shipping carton 300x220x180 mm",
  "3-ply printed retail carton 180x120x90 mm",
  "3-ply printed retail carton 220x160x120 mm",
  "5-ply heavy duty carton 300x250x220 mm",
  "5-ply heavy duty carton 400x300x250 mm",
  "5-ply export carton 500x400x350 mm",
  "Corrugated mailer box small",
  "Corrugated mailer box medium",
  "Die-cut e-commerce shipper A",
  "Die-cut e-commerce shipper B",
  "Partition insert 6-cell",
  "Partition insert 12-cell",
  "Corrugated sleeve 1L bottle",
  "Corrugated sleeve 2L bottle",
  "Edge protector 50 mm",
  "Edge protector 75 mm",
  "Single face corrugated roll 36 inch",
  "Single face corrugated roll 48 inch",
  "Pallet top sheet 1000x1200 mm",
  "Pallet layer pad 800x1200 mm",
  "Pizza box 9 inch plain",
  "Pizza box 12 inch printed",
  "Fruit tray 2 kg",
  "Fruit tray 5 kg",
  "Display shipper small",
  "Display shipper large",
  "Mailer envelope rigid A4",
  "Returnable corrugated tote liner"
];

export const lineItems: RfxLineItem[] = descriptions.map((description, index) => ({
  id: `line-${String(index + 1).padStart(2, "0")}`,
  rfxId,
  lineNumber: index + 1,
  sku: `CP-${String(index + 1).padStart(3, "0")}`,
  description,
  specification: index < 5 ? "32 ECT, kraft liner, moisture-resistant adhesive" : index < 18 ? "44 ECT, B/C flute, burst-tested" : "Buyer-approved corrugated grade",
  quantity: 6000 + index * 350,
  unit: "piece",
  requiredBy: "2026-10-30"
}));

export const vendors: Vendor[] = [
  { id: "vendor-a", code: "A", name: "Alpha Packwell", location: "Pune, IN", qualityStatus: "PASS" },
  { id: "vendor-b", code: "B", name: "Bharat Corrugates", location: "Ahmedabad, IN", qualityStatus: "PASS" },
  { id: "vendor-c", code: "C", name: "CartonCraft Works", location: "Chennai, IN", qualityStatus: "INCOMPLETE" },
  { id: "vendor-d", code: "D", name: "Delta Fibreboard", location: "Mumbai, IN", qualityStatus: "FAIL" },
  { id: "vendor-e", code: "E", name: "Eastern Box Makers", location: "Kolkata, IN", qualityStatus: "NOT_EVALUATED" }
];

export const responses: VendorResponse[] = [
  {
    id: "response-a",
    vendorId: "vendor-a",
    rfxId,
    format: "EXCEL",
    status: "PROCESSED",
    completeness: "COMPLETE",
    documentId: "doc-a",
    messinessNotes: ["Clean Excel-style response.", "Prices quoted per 100 pieces with freight included."],
    receivedAt: "2026-09-12T09:15:00.000Z"
  },
  {
    id: "response-b",
    vendorId: "vendor-b",
    rfxId,
    format: "PDF",
    status: "NEEDS_REVIEW",
    completeness: "AMBIGUOUS",
    documentId: "doc-b",
    messinessNotes: ["PDF-style quotation.", "Discount and freight language appears in footnotes."],
    receivedAt: "2026-09-13T11:40:00.000Z"
  },
  {
    id: "response-c",
    vendorId: "vendor-c",
    rfxId,
    format: "DOCX_EMAIL",
    status: "NEEDS_REVIEW",
    completeness: "PARTIAL",
    documentId: "doc-c",
    messinessNotes: ["DOCX/email-style response.", "Several prices, currency values, and lead times are missing."],
    receivedAt: "2026-09-14T15:20:00.000Z"
  },
  {
    id: "response-d",
    vendorId: "vendor-d",
    rfxId,
    format: "AMBIGUOUS_TEXT",
    status: "NEEDS_REVIEW",
    completeness: "AMBIGUOUS",
    documentId: "doc-d",
    messinessNotes: ["Uses alternate product names.", "One unmapped item and duplicate descriptions require review.", "Quality questionnaire failed."],
    receivedAt: "2026-09-15T10:10:00.000Z"
  },
  {
    id: "response-e",
    vendorId: "vendor-e",
    rfxId,
    format: "SCANNED_IMAGE",
    status: "NEEDS_REVIEW",
    completeness: "PARTIAL",
    documentId: "doc-e",
    messinessNotes: ["Scanned/image-style rate card.", "Low confidence values and missing lead times are expected for future extraction."],
    receivedAt: "2026-09-16T17:05:00.000Z"
  }
];

function seededHash(seed: string): string {
  return seed.padStart(64, "0").slice(-64);
}

export const documents: Document[] = responses.map((response) => ({
  id: response.documentId,
  vendorId: response.vendorId,
  rfxId: response.rfxId,
  vendorResponseId: response.id,
  filename: `${response.vendorId}.${response.format === "EXCEL" ? "xlsx" : response.format === "PDF" ? "pdf" : response.format === "DOCX_EMAIL" ? "docx" : response.format === "SCANNED_IMAGE" ? "png" : "txt"}`,
  mimeType: response.format === "EXCEL" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : response.format === "PDF" ? "application/pdf" : response.format === "DOCX_EMAIL" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : response.format === "SCANNED_IMAGE" ? "image/png" : "text/plain",
  fileSize: 0,
  contentHash: seededHash(response.vendorId.slice(-1).charCodeAt(0).toString(16)),
  sourceType: response.format === "EXCEL" ? "XLSX" : response.format === "PDF" ? "PDF" : response.format === "DOCX_EMAIL" ? "DOCX" : response.format === "SCANNED_IMAGE" ? "PNG" : "TXT",
  processingStatus: response.format === "SCANNED_IMAGE" ? "EXTRACTION_REQUIRED" : "PARSED",
  sourceKind: response.format,
  sha256: seededHash(response.vendorId.slice(-1).charCodeAt(0).toString(16)),
  storagePath: `fixtures/vendor-responses/${response.vendorId}.${response.format === "EXCEL" ? "xlsx" : response.format === "PDF" ? "pdf" : response.format === "DOCX_EMAIL" ? "docx" : response.format === "SCANNED_IMAGE" ? "png" : "txt"}`,
  isSeededFixture: true,
  createdAt: response.receivedAt,
  updatedAt: "2026-09-19T00:00:00.000Z"
}));

function quote(partial: Omit<QuoteLineItem, "normalizationStatus" | "normalizedUnitPrice" | "normalizedCurrency" | "exceptionStatus">): QuoteLineItem {
  return {
    ...partial,
    normalizationStatus: "UNRESOLVED",
    normalizedUnitPrice: null,
    normalizedCurrency: null,
    exceptionStatus: "NONE"
  };
}

export const quoteLineItems: QuoteLineItem[] = [
  ...lineItems.slice(0, 8).map((line, index) => quote({
    id: `quote-a-${line.id}`,
    vendorId: "vendor-a",
    vendorResponseId: "response-a",
    rfxLineItemId: line.id,
    originalDescription: line.description,
    quotedQuantity: line.quantity,
    originalPrice: 780 + index * 42,
    currency: "INR",
    unit: "hundred_pieces",
    packSize: null,
    freight: { kind: "included" },
    leadTimeDays: 21,
    qualityStatus: "PASS",
    sourceDocumentId: "doc-a"
  })),
  ...lineItems.slice(8, 14).map((line, index) => quote({
    id: `quote-b-${line.id}`,
    vendorId: "vendor-b",
    vendorResponseId: "response-b",
    rfxLineItemId: line.id,
    originalDescription: `PDF row ${index + 4}: ${line.description.replace("Corrugated", "C. board")}`,
    quotedQuantity: line.quantity,
    originalPrice: 11.25 + index * 0.65,
    currency: "INR",
    unit: "piece",
    packSize: null,
    freight: index % 2 === 0 ? { kind: "ambiguous", note: "Footnote says freight extra for non-local delivery." } : { kind: "excluded", amount: 90, currency: "INR", perUnit: "hundred_pieces" },
    leadTimeDays: index === 4 ? null : 28,
    qualityStatus: "PASS",
    sourceDocumentId: "doc-b"
  })),
  ...lineItems.slice(14, 20).map((line, index) => quote({
    id: `quote-c-${line.id}`,
    vendorId: "vendor-c",
    vendorResponseId: "response-c",
    rfxLineItemId: line.id,
    originalDescription: `Email: ${line.description}`,
    quotedQuantity: index === 2 ? null : line.quantity,
    originalPrice: index === 1 ? null : 14.5 + index,
    currency: index === 3 ? null : "INR",
    unit: index === 5 ? "box" : "piece",
    packSize: null,
    freight: { kind: "missing" },
    leadTimeDays: index < 3 ? 35 : null,
    qualityStatus: "INCOMPLETE",
    sourceDocumentId: "doc-c"
  })),
  ...lineItems.slice(20, 26).map((line, index) => quote({
    id: `quote-d-${line.id}`,
    vendorId: "vendor-d",
    vendorResponseId: "response-d",
    rfxLineItemId: index === 5 ? null : line.id,
    originalDescription: index === 0 ? "Top pad big size" : index === 1 ? "Separator pad 800 by 1200" : `Alt desc: ${line.description}`,
    quotedQuantity: line.quantity,
    originalPrice: index === 2 ? 0 : 0.22 + index * 0.04,
    currency: "USD",
    unit: index === 3 ? "unknown" : "piece",
    packSize: null,
    freight: { kind: "excluded", amount: 0.01, currency: "USD", perUnit: "piece" },
    leadTimeDays: 24,
    qualityStatus: "FAIL",
    sourceDocumentId: "doc-d"
  })),
  ...lineItems.slice(26, 30).map((line, index) => quote({
    id: `quote-e-${line.id}`,
    vendorId: "vendor-e",
    vendorResponseId: "response-e",
    rfxLineItemId: line.id,
    originalDescription: index === 0 ? "display shpr sm" : line.description,
    quotedQuantity: line.quantity,
    originalPrice: 16 + index * 2,
    currency: index === 2 ? null : "INR",
    unit: index < 2 ? "box" : "bundle",
    packSize: index === 1 ? 50 : null,
    freight: index === 3 ? { kind: "included" } : { kind: "missing" },
    leadTimeDays: index === 0 ? null : 32,
    qualityStatus: "NOT_EVALUATED",
    sourceDocumentId: "doc-e"
  }))
];

export const questionnaireAnswers: QuestionnaireAnswer[] = [
  { id: "qa-a-1", vendorId: "vendor-a", questionCode: "ISO", question: "Valid quality certification?", answer: "ISO 9001 valid through 2027", status: "PASS" },
  { id: "qa-b-1", vendorId: "vendor-b", questionCode: "ISO", question: "Valid quality certification?", answer: "ISO certificate attached", status: "PASS" },
  { id: "qa-c-1", vendorId: "vendor-c", questionCode: "ISO", question: "Valid quality certification?", answer: null, status: "INCOMPLETE" },
  { id: "qa-d-1", vendorId: "vendor-d", questionCode: "ECT", question: "Meets ECT requirement?", answer: "Can meet most requested grades", status: "FAIL" },
  { id: "qa-e-1", vendorId: "vendor-e", questionCode: "ISO", question: "Valid quality certification?", answer: null, status: "NOT_EVALUATED" }
];

export const evidence: Evidence[] = quoteLineItems.map((quoteItem) => ({
  id: `ev-${quoteItem.id}`,
  documentId: quoteItem.sourceDocumentId,
  quoteLineItemId: quoteItem.id,
  sourceLabel: "Seeded fixture data",
  sourceText: `${quoteItem.originalDescription}; price=${quoteItem.originalPrice ?? "missing"}; unit=${quoteItem.unit}; freight=${quoteItem.freight.kind}`,
  extractionMethod: "SEEDED_FIXTURE",
  confidence: quoteItem.sourceDocumentId === "doc-e" ? "LOW" : quoteItem.sourceDocumentId === "doc-d" ? "MEDIUM" : "HIGH"
}));

export const procurementEvent: ProcurementEvent = {
  rfx: {
    id: rfxId,
    title: "Corrugated packaging RFx - West India fulfillment network",
    category: "Corrugated packaging",
    description: "Thirty corrugated packaging SKUs across cartons, mailers, inserts, sheets, trays, and display shippers.",
    baseCurrency: "INR",
    status: "ACTIVE",
    createdAt: "2026-09-10T09:00:00.000Z",
    dueAt: "2026-09-20T17:00:00.000Z"
  },
  lineItems,
  vendors,
  responses,
  documents,
  quoteLineItems,
  questionnaireAnswers,
  evidence,
  scenarios: [
    { id: "scenario-lowest-total", name: "Lowest total cost", goal: "LOWEST_TOTAL_COST", constraints: [] },
    { id: "scenario-quality", name: "Lowest cost among quality-approved vendors", goal: "LOWEST_QUALITY_APPROVED_COST", constraints: ["quality_status = PASS"] },
    { id: "scenario-split", name: "Split award by line", goal: "SPLIT_AWARD", constraints: ["line_level_minimum_cost"] }
  ],
  analysisRuns: [],
  extractionRuns: documents.map((document) => ({
    id: `run-${document.id}-seeded`,
    documentId: document.id,
    contentHash: document.contentHash,
    parserName: document.sourceType === "PNG" ? "image-metadata" : document.sourceType === "XLSX" ? "sheetjs-workbook" : document.sourceType === "PDF" ? "pdfjs-text" : document.sourceType === "DOCX" ? "mammoth-docx" : "text-lines",
    parserVersion: "v1",
    extractionMethod: document.processingStatus === "EXTRACTION_REQUIRED" ? "AI_PENDING" : "DETERMINISTIC_PARSE",
    provider: null,
    model: null,
    status: document.processingStatus === "EXTRACTION_REQUIRED" ? "AI_PENDING" : "PARSED",
    startedAt: "2026-09-19T00:00:00.000Z",
    completedAt: document.processingStatus === "EXTRACTION_REQUIRED" ? null : "2026-09-19T00:00:00.000Z",
    error: null,
    resultReference: `seeded:${document.id}`
  }))
};
