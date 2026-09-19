import { procurementEvent } from "@/lib/fixtures/procurement-event";
import type { SupabaseServerClient } from "@/lib/supabase/server";

let seeded = false;

export async function ensureProcurementSeedInSupabase(client: SupabaseServerClient): Promise<void> {
  if (seeded) return;

  await client.upsertRows("rfx", {
    id: procurementEvent.rfx.id,
    title: procurementEvent.rfx.title,
    category: procurementEvent.rfx.category,
    description: procurementEvent.rfx.description,
    base_currency: procurementEvent.rfx.baseCurrency,
    status: procurementEvent.rfx.status,
    created_at: procurementEvent.rfx.createdAt,
    due_at: procurementEvent.rfx.dueAt
  });

  await client.upsertRows("vendors", procurementEvent.vendors.map((vendor) => ({
    id: vendor.id,
    code: vendor.code,
    name: vendor.name,
    location: vendor.location,
    quality_status: vendor.qualityStatus
  })));

  await client.upsertRows("rfx_line_items", procurementEvent.lineItems.map((line) => ({
    id: line.id,
    rfx_id: line.rfxId,
    line_number: line.lineNumber,
    sku: line.sku,
    description: line.description,
    specification: line.specification,
    quantity: line.quantity,
    unit: line.unit,
    required_by: line.requiredBy
  })));

  await client.upsertRows("vendor_responses", procurementEvent.responses.map((response) => ({
    id: response.id,
    vendor_id: response.vendorId,
    rfx_id: response.rfxId,
    format: response.format,
    status: response.status,
    completeness: response.completeness,
    document_id: response.documentId,
    messiness_notes: response.messinessNotes,
    received_at: response.receivedAt
  })));

  await client.upsertRows("documents", procurementEvent.documents.map((document) => ({
    id: document.id,
    vendor_id: document.vendorId,
    rfx_id: document.rfxId,
    vendor_response_id: document.vendorResponseId,
    filename: document.filename,
    mime_type: document.mimeType,
    file_size: document.fileSize,
    content_hash: document.contentHash,
    source_type: document.sourceType,
    processing_status: document.processingStatus,
    source_kind: document.sourceKind,
    sha256: document.sha256,
    storage_path: document.storagePath,
    is_seeded_fixture: document.isSeededFixture,
    created_at: document.createdAt,
    updated_at: document.updatedAt
  })));

  seeded = true;
}
