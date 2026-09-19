# Product And Architecture Decisions

## No MCP Server In MVP

MCP is deferred because internal deterministic functions are enough for the prototype. Functions are kept tool-shaped so MCP can be introduced later without redesigning the domain layer.

## No Autonomous Agents

The product needs controlled workflows, not agents continuously talking to each other. Future AI capabilities should be task-specific and retryable.

## Parser-First Extraction

Future extraction should use deterministic parsing before AI escalation to protect the API budget and improve reliability.

Goal 2 implements the parser-first foundation. Excel, DOCX, PDF, and TXT are parsed locally. Images are classified and marked `EXTRACTION_REQUIRED` because OCR/multimodal extraction belongs to the next AI goal.

## Deterministic Financial Calculations

LLMs must not calculate prices, freight, totals, or award scenarios. Code calculates those values and tests lock down behavior.

## Provenance Is Mandatory

Procurement decisions require trust. Important values must be traceable to source evidence and calculation rules.

## Demo Mode Exists

The demo must work even if an AI provider is unavailable. Seeded fixtures represent cached outputs and future live extraction will persist equivalent records.

## Parser Versioning

Parser results are cached by content hash, parser name, and parser version. This prevents unnecessary reprocessing while allowing deterministic cache invalidation when parser behavior changes.

## Vendor Documents Are Untrusted

Supplier files may contain prompt injection or malicious content. The system must not execute formulas, macros, scripts, embedded code, or document instructions. Future AI extraction must treat document content as quoted data, not instructions.

## Gemini Provider First

Goal 3 introduces one server-side Gemini provider through a narrow `QuoteExtractionProvider` interface. The app is not coupled directly to Gemini in the workflow, so another provider can be added later without changing procurement logic.

## AI Does Not Calculate

Gemini may identify that a supplier wrote `780 INR / per 100 pcs`, map it to an RFx line, and cite evidence. It must not calculate normalized unit price, landed cost, split awards, or totals. Those remain deterministic code paths.

## Comparison Is Facts Before Recommendation

Goal 4 builds comparison-ready facts and review states but intentionally avoids choosing a winner. The product should first establish comparable, evidence-backed data; recommendations, scenarios, split awards, and analyst reasoning belong to later goals.

## Analyst Is Tool-Backed

Goal 5 introduces the Procurement Analyst as a structured analysis workspace, not a generic chatbot. It reads deterministic tool outputs such as supplier coverage, comparison data, exceptions, evidence, and scenarios. The model-facing architecture must not ask an LLM to add prices or optimize awards.

## Prototype FX Rates Are Not Market Data

Currency conversion uses deterministic prototype/demo exchange rates so tests and demos are repeatable. The UI and docs label the rate source clearly and do not present it as live market data.

## Autonomous Award Execution Is Excluded

The system can recommend and explain. A human approves.
