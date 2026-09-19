import { calculateComparableQuote } from "@/lib/domain/calculations";
import type { ExceptionCode, ProcurementEvent, ProcurementException } from "@/lib/domain/types";

const codeMessages: Record<ExceptionCode, string> = {
  MISSING_QUOTE: "Supplier did not quote this RFx line; it must not be treated as zero.",
  MISSING_PRICE: "Quoted price is missing and cannot be treated as zero.",
  MISSING_CURRENCY: "Currency is missing, so the quote cannot be normalized.",
  AMBIGUOUS_CURRENCY: "Currency is ambiguous and requires buyer review.",
  INVALID_PRICE: "Quoted price is malformed or invalid.",
  MISSING_QUANTITY: "Quoted quantity is missing or unclear.",
  UNKNOWN_UNIT: "Quoted unit is unknown or unsupported.",
  AMBIGUOUS_UNIT: "Quoted unit is ambiguous and requires buyer review.",
  UNKNOWN_PACK_SIZE: "Pack size is required before a box or bundle quote can be converted to pieces.",
  UNIT_CONVERSION_REQUIRED: "Unit conversion cannot be performed without an explicit conversion basis.",
  MISSING_FREIGHT: "Freight treatment is missing and landed cost cannot be finalized.",
  AMBIGUOUS_FREIGHT: "Freight treatment is ambiguous and requires buyer review.",
  FREIGHT_AMBIGUOUS: "Freight applicability is unclear and requires buyer review.",
  MISSING_LEAD_TIME: "Lead time is missing and requires buyer review.",
  QUALITY_FAILURE: "Vendor failed at least one quality requirement.",
  INCOMPLETE_RESPONSE: "Vendor response is partial or incomplete.",
  UNMAPPED_LINE_ITEM: "Quoted item could not be mapped to an RFx line.",
  AMBIGUOUS_LINE_MATCH: "Supplier item mapping to the RFx line is ambiguous.",
  INSUFFICIENT_EVIDENCE: "Extracted value does not have enough supporting source evidence."
};

export function generateExceptionsForEvent(event: ProcurementEvent): ProcurementException[] {
  const now = "2026-09-19T00:00:00.000Z";
  const exceptions: ProcurementException[] = [];

  for (const response of event.responses) {
    if (response.completeness !== "COMPLETE") {
      exceptions.push({
        id: `ex-${response.id}-incomplete`,
        code: "INCOMPLETE_RESPONSE",
        severity: response.completeness === "PARTIAL" ? "HIGH" : "MEDIUM",
        message: codeMessages.INCOMPLETE_RESPONSE,
        vendorId: response.vendorId,
        createdAt: now
      });
    }
  }

  for (const quote of event.quoteLineItems) {
    const comparable = calculateComparableQuote(event, quote);
    for (const reason of comparable.exceptions) {
      const code = mapReasonToExceptionCode(reason);
      exceptions.push({
        id: `ex-${quote.id}-${code.toLowerCase()}`,
        code,
        severity: code === "QUALITY_FAILURE" || code === "MISSING_PRICE" ? "HIGH" : "MEDIUM",
        message: codeMessages[code],
        vendorId: quote.vendorId,
        quoteLineItemId: quote.id,
        rfxLineItemId: quote.rfxLineItemId ?? undefined,
        createdAt: now
      });
    }
  }

  return exceptions;
}

function mapReasonToExceptionCode(reason: string): ExceptionCode {
  if (reason === "MISSING_PRICE") return "MISSING_PRICE";
  if (reason === "MISSING_CURRENCY") return "MISSING_CURRENCY";
  if (reason === "UNKNOWN_UNIT") return "UNKNOWN_UNIT";
  if (reason === "UNKNOWN_PACK_SIZE") return "UNKNOWN_PACK_SIZE";
  if (reason === "UNIT_CONVERSION_REQUIRED") return "UNIT_CONVERSION_REQUIRED";
  if (reason === "MISSING_FREIGHT") return "MISSING_FREIGHT";
  if (reason === "AMBIGUOUS_FREIGHT") return "AMBIGUOUS_FREIGHT";
  if (reason === "MISSING_LEAD_TIME") return "MISSING_LEAD_TIME";
  if (reason === "QUALITY_FAILURE") return "QUALITY_FAILURE";
  if (reason === "UNMAPPED_LINE_ITEM") return "UNMAPPED_LINE_ITEM";
  return "UNKNOWN_UNIT";
}
