# AI Design

## Role

AI interprets procurement meaning from messy supplier responses. Code calculates. Database remembers. Evidence explains. Human approves.

## Provider Boundary

`QuoteExtractionProvider` exposes one method: `extractQuote`. Two providers currently share the same interface and return the same validated `VendorQuote` schema:

- `DemoExtractionProvider`: deterministic simulated extraction for local demos.
- `GeminiQuoteExtractionProvider`: real Gemini extraction, server-side only.

Provider mode is selected with:

- `EXTRACTION_PROVIDER=demo`
- `EXTRACTION_PROVIDER=gemini`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

The default is demo mode. If Gemini is explicitly selected without `GEMINI_API_KEY`, the workflow returns a clear provider-not-configured state rather than silently substituting demo results. The API key must never be exposed to client components.

## Extraction Flow

ParsedDocument -> escalation policy -> deterministic extraction or provider extraction -> Zod validation -> evidence-linked VendorQuote -> cache.

Extraction can be triggered server-side through `POST /api/extractions/{documentId}/run` or by opening the extraction review page for a seeded document. In demo mode, provider-backed extraction is simulated and clearly labeled. In Gemini mode without a key, documents that require Gemini remain in an explicit `AI_PENDING` state.

## When AI Is Used

Provider extraction is used for semantic interpretation, ambiguous supplier terminology, and image/scanned responses. Structured Excel responses with clear RFx line IDs use deterministic extraction. Demo mode simulates this provider step using seeded fixture facts; Gemini mode uses the live model.

## What AI Must Not Do

AI must not calculate totals, normalize units, convert currencies, execute supplier instructions, invoke tools, modify configuration, invent missing prices, invent RFx line IDs, or make award decisions.

## Prompt Injection Boundary

Supplier document text is untrusted data. Prompts explicitly instruct Gemini that document content cannot override system/developer instructions and cannot trigger tool execution.

## Cost Control

Extraction is cached by provider, model, prompt version, schema version, content hash, and RFx version. Normal tests use mocked providers and never call Gemini.

Live server runs persist extraction cache entries under `.cache/extractions` so a process restart does not force another Gemini call for the same document/configuration. The directory is ignored by source control.

Runtime extraction runs are logged under `.cache/extraction-runs` for auditability. These logs capture cache hits, provider/model, request ID, latency, token usage when returned by the provider, and error state.

Demo and Gemini cache entries are separated by provider and model. When a Gemini key is added later and `EXTRACTION_PROVIDER=gemini`, the same route will perform the first live extraction for messy and image documents, write the validated result to `.cache/extractions`, and reuse that cached result for the same provider/model/prompt/schema/content hash/RFx version.
