import type { Currency, FreightTerm, QuoteLineItem, Unit } from "@/lib/domain/types";

export type FxRates = Record<Currency, number>;

export const defaultFxRates: FxRates = {
  INR: 1,
  USD: 83.2,
  EUR: 90.1
};

export const defaultFxAssumption = {
  baseCurrency: "INR" as Currency,
  rates: defaultFxRates,
  source: "Prototype/demo exchange rates",
  timestamp: "2026-09-19T00:00:00.000Z"
};

export type NormalizationResult = {
  status: "NORMALIZED" | "UNRESOLVED";
  originalPrice: number | null;
  originalCurrency: Currency | null;
  originalUnit: Unit;
  normalizedUnitPrice: number | null;
  normalizedCurrency: Currency;
  normalizedUnit: "piece";
  exchangeRate: number | null;
  rateSource: string;
  rateTimestamp: string;
  reasons: string[];
};

export function convertCurrency(amount: number, from: Currency, to: Currency, fxRates: FxRates = defaultFxRates): number {
  if (from === to) {
    return roundMoney(amount);
  }

  const fromRate = fxRates[from];
  const toRate = fxRates[to];

  return roundMoney((amount * fromRate) / toRate);
}

export function unitDivisor(unit: Unit, packSize: number | null): number | null {
  if (unit === "piece") {
    return 1;
  }

  if (unit === "hundred_pieces") {
    return 100;
  }

  if ((unit === "box" || unit === "carton" || unit === "bundle") && packSize !== null && packSize > 0) {
    return packSize;
  }

  return null;
}

export function calculateNormalizedUnitPrice(
  quote: Pick<QuoteLineItem, "originalPrice" | "currency" | "unit" | "packSize">,
  targetCurrency: Currency = "INR",
  fxRates: FxRates = defaultFxRates
): NormalizationResult {
  const reasons: string[] = [];

  if (quote.originalPrice === null || quote.originalPrice <= 0) {
    reasons.push("MISSING_PRICE");
  }

  if (quote.currency === null) {
    reasons.push("MISSING_CURRENCY");
  }

  const divisor = unitDivisor(quote.unit, quote.packSize);
  if (divisor === null) {
    reasons.push(quote.unit === "box" || quote.unit === "carton" || quote.unit === "bundle" ? "UNKNOWN_PACK_SIZE" : "UNKNOWN_UNIT");
  }

  if (reasons.length > 0 || quote.originalPrice === null || quote.currency === null || divisor === null) {
    return {
      status: "UNRESOLVED",
      originalPrice: quote.originalPrice,
      originalCurrency: quote.currency,
      originalUnit: quote.unit,
      normalizedUnitPrice: null,
      normalizedCurrency: targetCurrency,
      normalizedUnit: "piece",
      exchangeRate: quote.currency ? exchangeRate(quote.currency, targetCurrency, fxRates) : null,
      rateSource: defaultFxAssumption.source,
      rateTimestamp: defaultFxAssumption.timestamp,
      reasons
    };
  }

  const sourceUnitPrice = quote.originalPrice / divisor;
  const normalizedUnitPrice = convertCurrency(sourceUnitPrice, quote.currency, targetCurrency, fxRates);

  return {
    status: "NORMALIZED",
    originalPrice: quote.originalPrice,
    originalCurrency: quote.currency,
    originalUnit: quote.unit,
    normalizedUnitPrice,
    normalizedCurrency: targetCurrency,
    normalizedUnit: "piece",
    exchangeRate: exchangeRate(quote.currency, targetCurrency, fxRates),
    rateSource: defaultFxAssumption.source,
    rateTimestamp: defaultFxAssumption.timestamp,
    reasons: []
  };
}

export function calculateFreight(freight: FreightTerm, targetCurrency: Currency = "INR", fxRates: FxRates = defaultFxRates): NormalizationResult {
  if (freight.kind === "included") {
    return {
      status: "NORMALIZED",
      originalPrice: 0,
      originalCurrency: targetCurrency,
      originalUnit: "piece",
      normalizedUnitPrice: 0,
      normalizedCurrency: targetCurrency,
      normalizedUnit: "piece",
      exchangeRate: 1,
      rateSource: defaultFxAssumption.source,
      rateTimestamp: defaultFxAssumption.timestamp,
      reasons: []
    };
  }

  if (freight.kind === "missing") {
    return unresolvedFreight("MISSING_FREIGHT", targetCurrency);
  }

  if (freight.kind === "ambiguous") {
    return unresolvedFreight("AMBIGUOUS_FREIGHT", targetCurrency);
  }

  return calculateNormalizedUnitPrice(
    {
      originalPrice: freight.amount,
      currency: freight.currency,
      unit: freight.perUnit,
      packSize: null
    },
    targetCurrency,
    fxRates
  );
}

function unresolvedFreight(reason: string, targetCurrency: Currency): NormalizationResult {
  return {
    status: "UNRESOLVED",
    originalPrice: null,
    originalCurrency: null,
    originalUnit: "unknown",
    normalizedUnitPrice: null,
    normalizedCurrency: targetCurrency,
    normalizedUnit: "piece",
    exchangeRate: null,
    rateSource: defaultFxAssumption.source,
    rateTimestamp: defaultFxAssumption.timestamp,
    reasons: [reason]
  };
}

function exchangeRate(from: Currency, to: Currency, fxRates: FxRates): number {
  return roundMoney(fxRates[from] / fxRates[to]);
}

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
