import { GoogleGenAI } from "@google/genai";
import { vendorQuoteExtractionJsonSchema } from "@/lib/extraction/json-schema";
import { buildQuoteExtractionPrompt } from "@/lib/extraction/prompt";
import type { QuoteExtractionProvider, QuoteExtractionProviderInput, QuoteExtractionProviderResult } from "@/lib/extraction/provider";
import { validateVendorQuoteExtraction } from "@/lib/extraction/schemas";

export class GeminiQuoteExtractionProvider implements QuoteExtractionProvider {
  provider = "gemini";
  model: string;
  private readonly apiKey: string;

  constructor(options?: { apiKey?: string; model?: string }) {
    const apiKey = options?.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required for Gemini quote extraction.");
    }
    this.apiKey = apiKey;
    this.model = options?.model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  }

  async extractQuote(input: QuoteExtractionProviderInput): Promise<QuoteExtractionProviderResult> {
    const started = Date.now();
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const prompt = buildQuoteExtractionPrompt(input);
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: prompt }];

    if (input.documentBytes && input.mimeType?.startsWith("image/")) {
      parts.push({
        inlineData: {
          mimeType: input.mimeType,
          data: Buffer.from(input.documentBytes).toString("base64")
        }
      });
    }

    const response = await ai.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts }],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: vendorQuoteExtractionJsonSchema
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned no text for quote extraction.");
    }

    const validLineIds = new Set(input.event.lineItems.map((line) => line.id));
    const extraction = validateVendorQuoteExtraction(JSON.parse(text), validLineIds);

    return {
      extraction,
      requestId: response.responseId ?? null,
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount,
            completionTokens: response.usageMetadata.candidatesTokenCount,
            totalTokens: response.usageMetadata.totalTokenCount
          }
        : null,
      latencyMs: Date.now() - started
    };
  }
}
