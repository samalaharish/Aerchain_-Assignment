import { createExtractionCacheKey, type ExtractionCacheKeyInput, type ExtractionCacheStore } from "@/lib/extraction/cache";
import type { ExtractionRunLog, ExtractionRunStore } from "@/lib/extraction/run-store";
import { vendorQuoteExtractionSchema, type ExtractionEvidence, type VendorQuoteExtraction } from "@/lib/extraction/schemas";
import { getSupabaseServerClient, type SupabaseServerClient } from "@/lib/supabase/server";
import { ensureProcurementSeedInSupabase } from "@/lib/supabase/seed";

export class SupabaseExtractionCache implements ExtractionCacheStore {
  constructor(private readonly client: SupabaseServerClient) {}

  async get(input: ExtractionCacheKeyInput): Promise<VendorQuoteExtraction | undefined> {
    const rows = await this.client.selectRows<{ result: unknown }>(
      "ai_extraction_cache",
      [
        `provider=eq.${encodeURIComponent(input.provider)}`,
        `model=eq.${encodeURIComponent(input.model)}`,
        `prompt_version=eq.${encodeURIComponent(input.promptVersion)}`,
        `schema_version=eq.${encodeURIComponent(input.schemaVersion)}`,
        `content_hash=eq.${encodeURIComponent(input.contentHash)}`,
        `rfx_id=eq.${encodeURIComponent(input.rfxVersion)}`,
        "select=result",
        "limit=1"
      ].join("&")
    );
    const result = rows[0]?.result;
    return result ? vendorQuoteExtractionSchema.parse(result) : undefined;
  }

  async set(input: ExtractionCacheKeyInput, value: VendorQuoteExtraction): Promise<void> {
    await ensureProcurementSeedInSupabase(this.client);
    const cacheKey = createExtractionCacheKey(input);
    await this.client.upsertRows("ai_extraction_cache", {
      id: cacheKey,
      document_id: value.documentId,
      content_hash: input.contentHash,
      rfx_id: input.rfxVersion,
      provider: input.provider,
      model: input.model,
      prompt_version: input.promptVersion,
      schema_version: input.schemaVersion,
      status: "EXTRACTED",
      request_id: null,
      result: value,
      error: null,
      updated_at: new Date().toISOString()
    });
    await persistEvidence(this.client, value);
  }
}

export class SupabaseExtractionRunStore implements ExtractionRunStore {
  constructor(private readonly client: SupabaseServerClient) {}

  async record(run: ExtractionRunLog): Promise<void> {
    await ensureProcurementSeedInSupabase(this.client);
    await this.client.upsertRows("extraction_runs", {
      id: run.runId,
      document_id: run.documentId,
      content_hash: run.cacheKey,
      parser_name: run.path,
      parser_version: "workflow-v1",
      extraction_method: run.path,
      provider: run.provider,
      model: run.model,
      status: run.status,
      started_at: run.startedAt,
      completed_at: run.completedAt,
      error: run.error,
      result_reference: run.cacheKey
    });
  }
}

export function createSupabaseExtractionCache(): SupabaseExtractionCache | null {
  const client = getSupabaseServerClient();
  return client ? new SupabaseExtractionCache(client) : null;
}

export function createSupabaseExtractionRunStore(): SupabaseExtractionRunStore | null {
  const client = getSupabaseServerClient();
  return client ? new SupabaseExtractionRunStore(client) : null;
}

export async function persistExtractionResultToSupabase(input: ExtractionCacheKeyInput, value: VendorQuoteExtraction): Promise<void> {
  const client = getSupabaseServerClient();
  if (!client) return;
  await new SupabaseExtractionCache(client).set(input, value);
}

async function persistEvidence(client: SupabaseServerClient, extraction: VendorQuoteExtraction): Promise<void> {
  const rows: Record<string, unknown>[] = [];
  for (const line of extraction.lineItems) {
    for (const evidence of [...line.evidence, ...line.freight.evidence]) {
      rows.push(evidenceRow(extraction, evidence, line.rfxLineId, line.confidence));
    }
  }
  for (const answer of extraction.qualityResponses) {
    for (const evidence of answer.evidence) {
      rows.push(evidenceRow(extraction, evidence, answer.questionCode, answer.confidence));
    }
  }
  for (const term of extraction.commercialTerms) {
    for (const evidence of term.evidence) {
      rows.push(evidenceRow(extraction, evidence, term.type, term.confidence));
    }
  }
  const dedupedRows = dedupeRowsByConflictKey(rows, "id");
  if (dedupedRows.length > 0) await client.upsertRows("evidence", dedupedRows);
}

export function dedupeRowsByConflictKey(rows: Record<string, unknown>[], conflictKey: string): Record<string, unknown>[] {
  const byKey = new Map<unknown, Record<string, unknown>>();
  for (const row of rows) {
    const key = row[conflictKey];
    if (key === undefined || key === null) {
      byKey.set(Symbol(), row);
      continue;
    }
    const existing = byKey.get(key);
    if (!existing || rowCompleteness(row) >= rowCompleteness(existing)) {
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values());
}

function evidenceRow(extraction: VendorQuoteExtraction, evidence: ExtractionEvidence, entityId: string, confidence: string): Record<string, unknown> {
  return {
    id: `${extraction.documentId}-${entityId}-${hashText(evidence.sourceLocation + evidence.text)}`,
    document_id: extraction.documentId,
    source_label: evidence.sourceLocation || extraction.documentId,
    source_text: evidence.text,
    extraction_method: extraction.extractionMethod,
    confidence,
    page: evidence.page,
    sheet: evidence.sheet,
    row_number: evidence.row,
    column_number: evidence.column,
    cell_reference: evidence.cell,
    source_location: evidence.sourceLocation,
    parser_name: evidence.parser,
    content_hash: evidence.contentHash
  };
}

function hashText(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(16);
}

function rowCompleteness(row: Record<string, unknown>): number {
  return Object.values(row).filter((value) => value !== undefined && value !== null && value !== "").length;
}
