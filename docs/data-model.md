# Data Model

## Core Entities

- `rfx`: procurement event header.
- `rfx_line_items`: buyer-requested line items.
- `vendors`: supplier master records.
- `vendor_responses`: supplier submission metadata.
- `documents`: source document metadata and hashes.
- `extraction_runs`: parser/AI escalation run records keyed by document hash, parser name, and parser version.
- `quote_line_items`: supplier quote values preserving original and normalized fields.
- `questionnaire_answers`: quality/compliance answers.
- `evidence`: source text and provenance.
- `exceptions`: deterministic review flags.
- `scenarios`: future analysis goals.
- `analysis_runs`: future analyst/scenario executions.
- `audit_events`: major system actions.

## Traceability

The target trace is RFx line -> vendor -> original quoted value -> normalized value -> calculation -> evidence -> analysis -> scenario -> recommendation.

Goal 2 adds source-level provenance for parsed documents: document -> parser/version -> page/sheet/row/column/line -> source text -> content hash. Later extraction can attach procurement fields to these locations.

Goal 4 adds the runtime `ComparisonDataset`, which groups every RFx line by every vendor. Each cell preserves original quote values, normalized currency/unit price, material extended price, freight unit cost, landed cost where determinable, review state, typed exceptions, confidence, and source evidence.

## Null Policy

Missing values remain `null`. The system must not convert missing price, currency, freight, pack size, or lead time into zero.

Missing supplier line items are represented as `NOT_QUOTED` with `MISSING_QUOTE`; they are never converted to zero.

## Parser Cache

A deterministic parse result is reusable only when `content_hash`, `parser_name`, and `parser_version` all match. Changing parser version invalidates cached parser output.

AI extraction cache entries are keyed by provider, model, prompt version, schema version, content hash, and RFx version. The Supabase schema includes `ai_extraction_cache`; the current app runtime also has a local file-backed cache for demo safety.

Extraction runs record provider, model, request ID, status, timing, token usage when available, error, and result reference. The schema supports database persistence; the current runtime writes equivalent audit logs to `.cache/extraction-runs`.
