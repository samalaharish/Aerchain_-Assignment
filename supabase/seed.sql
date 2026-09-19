insert into rfx (id, title, category, description, base_currency, status, created_at, due_at)
values (
  'rfx-corrugated-2026',
  'Corrugated packaging RFx - West India fulfillment network',
  'Corrugated packaging',
  'Thirty corrugated packaging SKUs across cartons, mailers, inserts, sheets, trays, and display shippers.',
  'INR',
  'ACTIVE',
  '2026-09-10T09:00:00Z',
  '2026-09-20T17:00:00Z'
) on conflict (id) do nothing;

insert into vendors (id, code, name, location, quality_status) values
  ('vendor-a', 'A', 'Alpha Packwell', 'Pune, IN', 'PASS'),
  ('vendor-b', 'B', 'Bharat Corrugates', 'Ahmedabad, IN', 'PASS'),
  ('vendor-c', 'C', 'CartonCraft Works', 'Chennai, IN', 'INCOMPLETE'),
  ('vendor-d', 'D', 'Delta Fibreboard', 'Mumbai, IN', 'FAIL'),
  ('vendor-e', 'E', 'Eastern Box Makers', 'Kolkata, IN', 'NOT_EVALUATED')
on conflict (id) do nothing;

insert into scenarios (id, name, goal, constraints) values
  ('scenario-lowest-total', 'Lowest total cost', 'LOWEST_TOTAL_COST', '{}'),
  ('scenario-quality', 'Lowest cost among quality-approved vendors', 'LOWEST_QUALITY_APPROVED_COST', '{"quality_status = PASS"}'),
  ('scenario-split', 'Split award by line', 'SPLIT_AWARD', '{"line_level_minimum_cost"}')
on conflict (id) do nothing;

insert into vendor_responses (id, vendor_id, rfx_id, format, status, completeness, document_id, messiness_notes, received_at) values
  ('response-a', 'vendor-a', 'rfx-corrugated-2026', 'EXCEL', 'PROCESSED', 'COMPLETE', 'doc-a', '{"Clean Excel-style response","Prices quoted per 100 pieces with freight included"}', '2026-09-12T09:15:00Z'),
  ('response-b', 'vendor-b', 'rfx-corrugated-2026', 'PDF', 'NEEDS_REVIEW', 'AMBIGUOUS', 'doc-b', '{"PDF-style quotation","Discount and freight language appears in footnotes"}', '2026-09-13T11:40:00Z'),
  ('response-c', 'vendor-c', 'rfx-corrugated-2026', 'DOCX_EMAIL', 'NEEDS_REVIEW', 'PARTIAL', 'doc-c', '{"DOCX/email-style response","Several prices, currency values, and lead times are missing"}', '2026-09-14T15:20:00Z'),
  ('response-d', 'vendor-d', 'rfx-corrugated-2026', 'AMBIGUOUS_TEXT', 'NEEDS_REVIEW', 'AMBIGUOUS', 'doc-d', '{"Uses alternate product names","One unmapped item and duplicate descriptions require review","Quality questionnaire failed"}', '2026-09-15T10:10:00Z'),
  ('response-e', 'vendor-e', 'rfx-corrugated-2026', 'SCANNED_IMAGE', 'NEEDS_REVIEW', 'PARTIAL', 'doc-e', '{"Scanned/image-style rate card","Low confidence values and missing lead times are expected for future extraction"}', '2026-09-16T17:05:00Z')
on conflict (id) do nothing;

insert into documents (
  id, vendor_id, rfx_id, vendor_response_id, filename, mime_type, file_size, content_hash,
  source_type, processing_status, source_kind, sha256, storage_path, is_seeded_fixture, created_at, updated_at
) values
  ('doc-a', 'vendor-a', 'rfx-corrugated-2026', 'response-a', 'vendor-a.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 0, repeat('a', 64), 'XLSX', 'PARSED', 'EXCEL', repeat('a', 64), 'fixtures/vendor-responses/vendor-a.xlsx', true, '2026-09-12T09:15:00Z', '2026-09-19T00:00:00Z'),
  ('doc-b', 'vendor-b', 'rfx-corrugated-2026', 'response-b', 'vendor-b.pdf', 'application/pdf', 0, repeat('b', 64), 'PDF', 'PARSED', 'PDF', repeat('b', 64), 'fixtures/vendor-responses/vendor-b.pdf', true, '2026-09-13T11:40:00Z', '2026-09-19T00:00:00Z'),
  ('doc-c', 'vendor-c', 'rfx-corrugated-2026', 'response-c', 'vendor-c.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 0, repeat('c', 64), 'DOCX', 'PARSED', 'DOCX_EMAIL', repeat('c', 64), 'fixtures/vendor-responses/vendor-c.docx', true, '2026-09-14T15:20:00Z', '2026-09-19T00:00:00Z'),
  ('doc-d', 'vendor-d', 'rfx-corrugated-2026', 'response-d', 'vendor-d.txt', 'text/plain', 0, repeat('d', 64), 'TXT', 'PARSED', 'AMBIGUOUS_TEXT', repeat('d', 64), 'fixtures/vendor-responses/vendor-d.txt', true, '2026-09-15T10:10:00Z', '2026-09-19T00:00:00Z'),
  ('doc-e', 'vendor-e', 'rfx-corrugated-2026', 'response-e', 'vendor-e.png', 'image/png', 0, repeat('e', 64), 'PNG', 'EXTRACTION_REQUIRED', 'SCANNED_IMAGE', repeat('e', 64), 'fixtures/vendor-responses/vendor-e.png', true, '2026-09-16T17:05:00Z', '2026-09-19T00:00:00Z')
on conflict (id) do nothing;

insert into extraction_runs (
  id, document_id, content_hash, parser_name, parser_version, extraction_method,
  provider, model, status, started_at, completed_at, error, result_reference
) values
  ('run-doc-a-seeded', 'doc-a', repeat('a', 64), 'sheetjs-workbook', 'v1', 'DETERMINISTIC_PARSE', null, null, 'PARSED', '2026-09-19T00:00:00Z', '2026-09-19T00:00:00Z', null, 'seeded:doc-a'),
  ('run-doc-b-seeded', 'doc-b', repeat('b', 64), 'pdfjs-text', 'v1', 'DETERMINISTIC_PARSE', null, null, 'PARSED', '2026-09-19T00:00:00Z', '2026-09-19T00:00:00Z', null, 'seeded:doc-b'),
  ('run-doc-c-seeded', 'doc-c', repeat('c', 64), 'mammoth-docx', 'v1', 'DETERMINISTIC_PARSE', null, null, 'PARSED', '2026-09-19T00:00:00Z', '2026-09-19T00:00:00Z', null, 'seeded:doc-c'),
  ('run-doc-d-seeded', 'doc-d', repeat('d', 64), 'text-lines', 'v1', 'DETERMINISTIC_PARSE', null, null, 'PARSED', '2026-09-19T00:00:00Z', '2026-09-19T00:00:00Z', null, 'seeded:doc-d'),
  ('run-doc-e-seeded', 'doc-e', repeat('e', 64), 'image-metadata', 'v1', 'AI_PENDING', null, null, 'AI_PENDING', '2026-09-19T00:00:00Z', null, null, 'seeded:doc-e')
on conflict (id) do nothing;

insert into audit_events (event_type, actor, entity_type, entity_id, details)
values
  ('RFx created', 'seed', 'rfx', 'rfx-corrugated-2026', '{"mode":"demo_seed"}'),
  ('Vendor fixtures registered', 'seed', 'vendor_response', 'all', '{"count":5,"ai_calls":0}');
