export const vendorQuoteExtractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    vendorId: { type: "string" },
    vendorName: { type: "string" },
    documentId: { type: "string" },
    extractionMethod: { type: "string", enum: ["AI_GEMINI", "AI_OPENAI"] },
    provider: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          rfxLineId: { type: "string" },
          status: { type: "string", enum: ["QUOTED", "NOT_QUOTED", "AMBIGUOUS"] },
          vendorDescription: { type: ["string", "null"] },
          quotedQuantity: { type: ["number", "null"] },
          quotedUnit: { type: ["string", "null"] },
          unitPrice: { type: ["number", "null"] },
          currency: { type: ["string", "null"], enum: ["INR", "USD", "EUR", null] },
          leadTimeDays: { type: ["integer", "null"] },
          freight: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: { type: "string", enum: ["included", "excluded", "missing", "ambiguous"] },
              amount: { type: ["number", "null"] },
              currency: { type: ["string", "null"], enum: ["INR", "USD", "EUR", null] },
              unit: { type: ["string", "null"] },
              notes: { type: ["string", "null"] },
              evidence: { type: "array", items: { $ref: "#/$defs/evidence" } }
            },
            required: ["kind", "amount", "currency", "unit", "notes", "evidence"]
          },
          notes: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
          evidence: { type: "array", items: { $ref: "#/$defs/evidence" } },
          warnings: { type: "array", items: { type: "string" } }
        },
        required: ["rfxLineId", "status", "vendorDescription", "quotedQuantity", "quotedUnit", "unitPrice", "currency", "leadTimeDays", "freight", "notes", "confidence", "evidence", "warnings"]
      }
    },
    qualityResponses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          questionCode: { type: "string" },
          question: { type: "string" },
          answer: { type: ["string", "null"] },
          status: { type: "string", enum: ["PASS", "FAIL", "INCOMPLETE", "NOT_EVALUATED"] },
          confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
          evidence: { type: "array", items: { $ref: "#/$defs/evidence" } }
        },
        required: ["questionCode", "question", "answer", "status", "confidence", "evidence"]
      }
    },
    commercialTerms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["payment_terms", "validity", "minimum_order_quantity", "shipping", "other"] },
          value: { type: "string" },
          confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
          evidence: { type: "array", items: { $ref: "#/$defs/evidence" } }
        },
        required: ["type", "value", "confidence", "evidence"]
      }
    },
    extractionWarnings: { type: "array", items: { type: "string" } },
    overallConfidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] }
  },
  required: ["vendorId", "vendorName", "documentId", "extractionMethod", "provider", "model", "lineItems", "qualityResponses", "commercialTerms", "extractionWarnings", "overallConfidence"],
  $defs: {
    evidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        documentId: { type: "string" },
        text: { type: "string" },
        page: { type: "integer" },
        sheet: { type: "string" },
        row: { type: "integer" },
        column: { type: "integer" },
        cell: { type: "string" },
        line: { type: "integer" },
        sourceLocation: { type: "string" },
        parser: { type: "string" },
        contentHash: { type: "string" }
      },
      required: ["documentId", "text", "sourceLocation", "parser", "contentHash"]
    }
  }
} as const;
