import { runFixtureExtractionWorkflow, type ExtractionWorkflowResult } from "@/lib/extraction/workflow";

export type ExtractionApiResponse =
  | {
      ok: true;
      result: ExtractionWorkflowResult;
    }
  | {
      ok: false;
      error: {
        message: string;
      };
    };

type ExtractionRunner = (documentId: string) => Promise<ExtractionWorkflowResult>;

export async function runExtractionApi(
  documentId: string,
  runner: ExtractionRunner = runFixtureExtractionWorkflow
): Promise<ExtractionApiResponse> {
  try {
    return {
      ok: true,
      result: await runner(documentId)
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        message: error instanceof Error ? error.message : "Unknown extraction failure."
      }
    };
  }
}
