import { calculateFreight, calculateNormalizedUnitPrice, roundMoney, type FxRates, defaultFxRates } from "@/lib/domain/normalization";
import type { Currency, ProcurementEvent, QuoteLineItem } from "@/lib/domain/types";

export type ComparableQuote = {
  status: "COMPARABLE" | "UNRESOLVED";
  quoteLineItemId: string;
  normalizedUnitPrice: number | null;
  normalizedCurrency: Currency;
  freightUnitCost: number | null;
  landedUnitCost: number | null;
  lineTotal: number | null;
  exceptions: string[];
};

export function calculateLineTotal(unitPrice: number | null, quantity: number | null): number | null {
  if (unitPrice === null || quantity === null || quantity <= 0) {
    return null;
  }

  return roundMoney(unitPrice * quantity);
}

export function calculateLandedCost(unitPrice: number | null, freightUnitCost: number | null): number | null {
  if (unitPrice === null || freightUnitCost === null) {
    return null;
  }

  return roundMoney(unitPrice + freightUnitCost);
}

export function calculateComparableQuote(
  event: ProcurementEvent,
  quote: QuoteLineItem,
  targetCurrency: Currency = event.rfx.baseCurrency,
  fxRates: FxRates = defaultFxRates
): ComparableQuote {
  const line = event.lineItems.find((item) => item.id === quote.rfxLineItemId);
  const price = calculateNormalizedUnitPrice(quote, targetCurrency, fxRates);
  const freight = calculateFreight(quote.freight, targetCurrency, fxRates);
  const exceptions = [...price.reasons, ...freight.reasons];

  if (quote.leadTimeDays === null) {
    exceptions.push("MISSING_LEAD_TIME");
  }

  if (quote.qualityStatus === "FAIL") {
    exceptions.push("QUALITY_FAILURE");
  }

  if (quote.rfxLineItemId === null || line === undefined) {
    exceptions.push("UNMAPPED_LINE_ITEM");
  }

  const landedUnitCost = calculateLandedCost(price.normalizedUnitPrice, freight.normalizedUnitPrice);
  const lineTotal = calculateLineTotal(landedUnitCost, line?.quantity ?? null);
  const status = exceptions.length === 0 && landedUnitCost !== null ? "COMPARABLE" : "UNRESOLVED";

  return {
    status,
    quoteLineItemId: quote.id,
    normalizedUnitPrice: price.normalizedUnitPrice,
    normalizedCurrency: targetCurrency,
    freightUnitCost: freight.normalizedUnitPrice,
    landedUnitCost,
    lineTotal,
    exceptions
  };
}

export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

export function summarizeProcurementEvent(event: ProcurementEvent) {
  const comparableQuotes = event.quoteLineItems.map((quote) => calculateComparableQuote(event, quote));
  const exceptionCount = comparableQuotes.reduce((total, item) => total + item.exceptions.length, 0);

  return {
    activeRfxCount: event.rfx.status === "ACTIVE" ? 1 : 0,
    lineItemCount: event.lineItems.length,
    vendorCount: event.vendors.length,
    responseCount: event.responses.length,
    exceptionCount,
    processingStatus: "Demo ready"
  };
}
