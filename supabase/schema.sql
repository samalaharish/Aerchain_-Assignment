create table if not exists rfx (
  id text primary key,
  title text not null,
  category text not null,
  description text not null,
  base_currency text not null,
  status text not null,
  created_at timestamptz not null default now(),
  due_at timestamptz not null
);

create table if not exists rfx_line_items (
  id text primary key,
  rfx_id text not null references rfx(id) on delete cascade,
  line_number integer not null,
  sku text not null,
  description text not null,
  specification text not null,
  quantity numeric not null,
  unit text not null,
  required_by date not null,
  unique (rfx_id, line_number)
);

create table if not exists vendors (
  id text primary key,
  code text not null unique,
  name text not null,
  location text not null,
  quality_status text not null
);

create table if not exists vendor_responses (
  id text primary key,
  vendor_id text not null references vendors(id),
  rfx_id text not null references rfx(id),
  format text not null,
  status text not null,
  completeness text not null,
  document_id text not null,
  messiness_notes text[] not null default '{}',
  received_at timestamptz not null
);

create table if not exists documents (
  id text primary key,
  vendor_id text references vendors(id),
  rfx_id text references rfx(id),
  vendor_response_id text not null references vendor_responses(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  file_size bigint not null default 0,
  content_hash text not null,
  source_type text not null,
  processing_status text not null,
  source_kind text not null,
  sha256 text not null,
  storage_path text not null,
  is_seeded_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists documents_content_hash_idx on documents(content_hash);
create index if not exists documents_vendor_rfx_idx on documents(vendor_id, rfx_id);
create index if not exists documents_processing_status_idx on documents(processing_status);

create table if not exists extraction_runs (
  id text primary key,
  document_id text not null references documents(id) on delete cascade,
  content_hash text not null,
  parser_name text not null,
  parser_version text not null,
  extraction_method text not null,
  provider text,
  model text,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text,
  result_reference text
);

create index if not exists extraction_runs_document_idx on extraction_runs(document_id);
create index if not exists extraction_runs_cache_idx on extraction_runs(content_hash, parser_name, parser_version);
create index if not exists extraction_runs_status_idx on extraction_runs(status);

create table if not exists ai_extraction_cache (
  id text primary key,
  document_id text not null references documents(id) on delete cascade,
  content_hash text not null,
  rfx_id text not null references rfx(id),
  provider text not null,
  model text not null,
  prompt_version text not null,
  schema_version text not null,
  status text not null,
  request_id text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  latency_ms integer,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_extraction_cache_config_idx
  on ai_extraction_cache(provider, model, prompt_version, schema_version, content_hash, rfx_id);

create table if not exists quote_line_items (
  id text primary key,
  vendor_id text not null references vendors(id),
  vendor_response_id text not null references vendor_responses(id),
  rfx_line_item_id text references rfx_line_items(id),
  original_description text not null,
  quoted_quantity numeric,
  original_price numeric,
  currency text,
  unit text not null,
  pack_size numeric,
  freight jsonb not null,
  lead_time_days integer,
  quality_status text not null,
  source_document_id text not null references documents(id),
  normalization_status text not null,
  normalized_unit_price numeric,
  normalized_currency text,
  exception_status text not null
);

create index if not exists quote_line_items_vendor_idx on quote_line_items(vendor_id);
create index if not exists quote_line_items_rfx_line_idx on quote_line_items(rfx_line_item_id);

create table if not exists questionnaire_answers (
  id text primary key,
  vendor_id text not null references vendors(id),
  question_code text not null,
  question text not null,
  answer text,
  status text not null
);

create table if not exists evidence (
  id text primary key,
  document_id text not null references documents(id),
  quote_line_item_id text references quote_line_items(id),
  source_label text not null,
  source_text text not null,
  extraction_method text not null,
  confidence text not null,
  page integer,
  sheet text,
  row_number integer,
  column_number integer,
  cell_reference text,
  source_location text,
  parser_name text,
  parser_version text,
  content_hash text
);

create index if not exists evidence_document_idx on evidence(document_id);
create index if not exists evidence_hash_idx on evidence(content_hash);

create table if not exists exceptions (
  id text primary key,
  code text not null,
  severity text not null,
  message text not null,
  vendor_id text references vendors(id),
  quote_line_item_id text references quote_line_items(id),
  rfx_line_item_id text references rfx_line_items(id),
  evidence_id text references evidence(id),
  created_at timestamptz not null default now()
);

create table if not exists analysis_runs (
  id text primary key,
  scenario_id text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists scenarios (
  id text primary key,
  name text not null,
  goal text not null,
  constraints text[] not null default '{}'
);

create table if not exists audit_events (
  id bigserial primary key,
  event_type text not null,
  actor text not null default 'system',
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
