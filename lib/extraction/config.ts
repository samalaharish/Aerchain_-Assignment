import { DemoExtractionProvider } from "@/lib/extraction/providers/demo";
import { GeminiQuoteExtractionProvider } from "@/lib/extraction/providers/gemini";
import { OpenAIQuoteExtractionProvider } from "@/lib/extraction/providers/openai";
import type { QuoteExtractionProvider } from "@/lib/extraction/provider";

export type ExtractionProviderMode = "demo" | "gemini" | "openai";

export type ProviderSelection = {
  mode: ExtractionProviderMode;
  provider: QuoteExtractionProvider | null;
  providerName: "demo" | "gemini" | "openai";
  model: string;
  configurationError: string | null;
  isDemoMode: boolean;
};

type Env = Record<string, string | undefined>;

export function getExtractionProviderMode(env: Env = process.env): ExtractionProviderMode {
  const raw = env.EXTRACTION_PROVIDER?.trim().toLowerCase();
  if (!raw) return "demo";
  if (raw === "demo" || raw === "gemini" || raw === "openai") return raw;
  throw new Error(`Unsupported EXTRACTION_PROVIDER "${env.EXTRACTION_PROVIDER}". Supported values: demo, gemini, openai.`);
}

export function getExtractionProviderLabel(env: Env = process.env): string {
  const mode = getExtractionProviderMode(env);
  if (mode === "gemini") return "Gemini";
  if (mode === "openai") return "OpenAI";
  return "Demo";
}

export function selectExtractionProvider(env: Env = process.env): ProviderSelection {
  const mode = getExtractionProviderMode(env);

  if (mode === "demo") {
    const provider = new DemoExtractionProvider();
    return {
      mode,
      provider,
      providerName: "demo",
      model: provider.model,
      configurationError: null,
      isDemoMode: true
    };
  }

  if (mode === "openai") {
    const model = env.OPENAI_EXTRACTION_MODEL?.trim() || env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    if (!env.OPENAI_API_KEY) {
      return {
        mode,
        provider: null,
        providerName: "openai",
        model,
        configurationError: "EXTRACTION_PROVIDER=openai but OPENAI_API_KEY is not configured.",
        isDemoMode: false
      };
    }

    return {
      mode,
      provider: new OpenAIQuoteExtractionProvider({ apiKey: env.OPENAI_API_KEY, model }),
      providerName: "openai",
      model,
      configurationError: null,
      isDemoMode: false
    };
  }

  const model = env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  if (!env.GEMINI_API_KEY) {
    return {
      mode,
      provider: null,
      providerName: "gemini",
      model,
      configurationError: "EXTRACTION_PROVIDER=gemini but GEMINI_API_KEY is not configured.",
      isDemoMode: false
    };
  }

  return {
    mode,
    provider: new GeminiQuoteExtractionProvider({ apiKey: env.GEMINI_API_KEY, model }),
    providerName: "gemini",
    model,
    configurationError: null,
    isDemoMode: false
  };
}
