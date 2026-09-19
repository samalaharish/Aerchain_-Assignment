import type { RfxLineItem } from "@/lib/domain/types";

export type MatchResult =
  | { status: "MATCHED"; rfxLineId: string; confidence: "HIGH" | "MEDIUM" }
  | { status: "AMBIGUOUS"; candidateRfxLineIds: string[] }
  | { status: "UNKNOWN" };

const synonyms: Record<string, string> = {
  c: "corrugated",
  board: "corrugated",
  layer: "ply",
  shpr: "shipper",
  ecommerce: "e-commerce",
  separator: "partition",
  pad: "sheet",
  top: "top",
  big: "large"
};

export function matchRfxLine(description: string, lineItems: RfxLineItem[], explicitLineNumber?: number | null): MatchResult {
  if (explicitLineNumber !== undefined && explicitLineNumber !== null) {
    const line = lineItems.find((item) => item.lineNumber === explicitLineNumber);
    return line ? { status: "MATCHED", rfxLineId: line.id, confidence: "HIGH" } : { status: "UNKNOWN" };
  }

  const queryTokens = tokenize(description);
  const normalizedQuery = normalize(description);
  const exact = queryTokens.length >= 4
    ? lineItems.find((line) => normalize(line.description).includes(normalizedQuery) || normalizedQuery.includes(normalize(line.description)))
    : undefined;
  if (exact) {
    return { status: "MATCHED", rfxLineId: exact.id, confidence: "HIGH" };
  }

  const scored = lineItems
    .map((line) => ({ line, score: scoreTokens(queryTokens, tokenize(`${line.description} ${line.specification}`)) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { status: "UNKNOWN" };
  }

  const [best, second] = scored;
  if (second && best.score - second.score < 2) {
    return { status: "AMBIGUOUS", candidateRfxLineIds: scored.slice(0, 3).map((item) => item.line.id) };
  }

  return { status: "MATCHED", rfxLineId: best.line.id, confidence: best.score >= 5 ? "HIGH" : "MEDIUM" };
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .map((token) => synonyms[token] ?? token);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[x*]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTokens(query: string[], target: string[]): number {
  const targetSet = new Set(target);
  return query.reduce((score, token) => score + (targetSet.has(token) ? tokenWeight(token) : 0), 0);
}

function tokenWeight(token: string): number {
  return /^\d+$/.test(token) ? 2 : 1;
}
