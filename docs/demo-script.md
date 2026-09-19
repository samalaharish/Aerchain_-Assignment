# Demo Script

## 5-8 Minute Buyer Journey

1. Open `/dashboard`.
   - Show the active corrugated packaging RFx, five vendors, 30 lines, and exception count.
   - Demonstrates a reliable demo-safe foundation with no live AI calls.

2. Open `/rfx`.
   - Review the 30 requested line items and specifications.
   - Demonstrates buyer-entered RFx structure.

3. Open `/responses`.
   - Walk through five vendor response formats: clean Excel, PDF quotation, DOCX/email partial response, ambiguous terminology, scanned/image-style quote.
   - Demonstrates messy procurement inputs.
   - Point out the provider label. In local demo mode it should say that extraction is simulated.

4. Open `/comparison`.
   - Show the 30 RFx lines by five vendors.
   - Show original quote values beside normalized unit/material/freight/landed values.
   - Demonstrates deterministic calculations such as INR per 100 pieces to INR per piece and USD to INR using prototype FX rates.
   - Use the filters to show review-required, blocked, not-quoted, and ambiguous rows.

5. Open `/responses/doc-a`.
   - Show deterministic structured extraction from the clean Excel fixture.
   - Demonstrates that AI is not used when parser-first extraction is sufficient.

6. Open `/responses/doc-d` or `/responses/doc-e`.
   - Show AI-required extraction path, cache key, provider status, confidence, warnings, and evidence.
   - Demonstrates messy terminology and scanned/image escalation without pretending uncertainty is solved.
   - In `EXTRACTION_PROVIDER=demo`, show "Demo extraction - simulated provider" and explain that the result uses the same schema/cache/evidence path as Gemini.
   - In `EXTRACTION_PROVIDER=gemini`, trigger `POST /api/extractions/doc-d/run` or `POST /api/extractions/doc-e/run` to perform live Gemini extraction. If the key is missing, show the explicit provider-not-configured state.

7. Point out unresolved rows.
   - Show missing currency, missing price, unknown pack size, freight ambiguity, quality failure, and missing lead time.
   - Demonstrates that the system does not guess.

8. Open `/exceptions`.
   - Show the review queue with typed exceptions and expandable evidence.
   - Emphasize that missing quotes are not zero and ambiguous values are not guessed.

9. Preview future `/analyst` and `/scenarios` screens.
   - Ask the Procurement Analyst which supplier coverage is incomplete and where the biggest exceptions are.
   - Open scenarios and compare lowest comparable cost, quality-approved suppliers, and split-award calculations.

10. Final decision story.
   - Open `/approval` and show the decision summary.
   - Emphasize that approval is human-controlled and does not send purchase orders or supplier awards.
