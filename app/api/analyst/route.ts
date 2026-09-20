import { NextResponse } from "next/server";
import { z } from "zod";
import { answerProcurementAnalystQuestion } from "@/lib/domain/ai-analyst";
import { buildDemoComparisonDataset } from "@/lib/extraction/comparison-source";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  question: z.string().min(1),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string()
  })).optional()
});

export async function POST(request: Request) {
  const input = requestSchema.parse(await request.json());
  const dataset = await buildDemoComparisonDataset();
  const answer = await answerProcurementAnalystQuestion({
    dataset,
    question: input.question,
    history: input.history?.map((item) => `${item.role}: ${item.content}`)
  });
  return NextResponse.json(answer);
}
