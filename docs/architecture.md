# Architecture

## Foundation

The app is a Next.js TypeScript application with deterministic procurement domain logic under `lib/domain` and seeded demo data under `lib/fixtures`. UI pages read domain data through typed objects rather than loose JSON.

## Demo-First Mode

Seeded data loads without live AI calls. Future extraction results can replace seeded fixture values because the data model already separates RFx lines, vendor responses, documents, quote lines, evidence, exceptions, scenarios, and audit events.

Goal 3.5 adds `EXTRACTION_PROVIDER=demo`, which is the default local mode. Demo mode uses a deterministic `DemoExtractionProvider` through the same provider interface, Zod schema, cache, extraction-run logging, and review UI as Gemini. It is clearly labeled as simulated extraction and never pretends to be Gemini.

## Document Ingestion Pipeline

Vendor Document -> Classification -> Content Hash -> Cache Check -> Deterministic Parser -> ParsedDocument -> Validation -> Parsed successfully or AI extraction required.

Goal 2 implements this boundary without AI calls. Deterministic parsing handles file structure whenever possible. AI will later interpret procurement meaning from validated parsed content.

## Parser Boundary

Parsing is not procurement extraction. Excel, PDF, DOCX, TXT, and image parsers only describe what exists in the source document: text, rows, cells, pages, metadata, warnings, and source locations. They do not decide RFx mapping, freight meaning, quality eligibility, or award logic.

## Deterministic Calculations

Financial and normalization logic lives outside React components. The functions in `lib/domain` calculate unit normalization, freight, landed cost, comparable status, and exceptions without an LLM.

## AI Extraction

Goal 3 adds the first AI procurement extraction layer. Provider-backed extraction receives only the relevant RFx lines, parsed document content, source locations, and image bytes when needed. It returns structured JSON that is validated with Zod before the app can use it.

Provider modes:

- `demo`: deterministic simulated extraction for local demos without credentials.
- `gemini`: real Gemini extraction, server-side only, requiring `GEMINI_API_KEY`.

Vendor documents are untrusted input. Their text must never override system/developer instructions, execute code, change application configuration, or invoke privileged tools.

## AI Extraction Boundary

AI maps messy supplier language to existing RFx line IDs and extracts commercial facts with evidence. Code still calculates all normalized prices, currency conversions, landed costs, totals, comparisons, and scenarios.

## Normalization And Comparison

Goal 4 turns validated `VendorQuote` outputs into a deterministic `ComparisonDataset`:

Vendor Document -> ParsedDocument -> VendorQuote -> validation -> normalization -> exceptions -> comparable quote facts -> buyer comparison.

The normalizer preserves original supplier values beside normalized values. Currency conversion uses prototype/demo FX assumptions, unit conversion only happens for explicit supported bases, freight remains separate from material price, and missing quotes become `MISSING_QUOTE` rather than zero. Review states are `READY`, `REVIEW_REQUIRED`, and `BLOCKED`.

## Buyer Workflow And Analyst

Goal 5 organizes the app around the buyer journey: Overview -> Responses -> Review -> Compare -> Analyze -> Scenarios -> Decision. The Procurement Analyst uses deterministic tool functions over the comparison dataset, supplier coverage, exceptions, evidence, and scenario results. It may explain results, but deterministic code calculates costs, coverage, split allocations, and scenario totals.

## AI Cache

AI extraction is cacheable by provider, model, prompt version, schema version, document content hash, and RFx version. Re-running the same document/configuration should reuse the cached result rather than spending API credits.

The current runtime implementation uses a file-backed server cache under `.cache/extractions` for live provider runs, plus schema support for a future Supabase-backed `ai_extraction_cache` table. Tests inject an in-memory cache so they never spend credits.

Extraction run metadata is also written under `.cache/extraction-runs` during runtime, including provider, model, status, request ID, latency, token usage when available, errors, and cache-hit status.

## Deferred Architecture

No MCP server, autonomous agents, ERP integrations, production email ingestion, supplier award execution, analyst, scenario optimization, or award recommendation are included in the current MVP layer.
