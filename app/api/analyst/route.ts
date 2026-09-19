import { NextResponse } from "next/server";
import { z } from "zod";
import { answerProcurementAnalystQuestion } from "@/lib/domain/ai-analyst";
import { buildDemoComparisonDataset } from "@/lib/extraction/comparison-source";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  question: z.string().min(1)
});

export async function POST(request: Request) {
  const input = requestSchema.parse(await request.json());
  const dataset = await buildDemoComparisonDataset();
  const answer = await answerProcurementAnalystQuestion({ dataset, question: input.question });
  return NextResponse.json(answer);
}
