import { NextResponse } from "next/server";
import { z } from "zod";
import { generateRfxDraft } from "@/lib/rfx/copilot";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  prompt: z.string().min(1)
});

export async function POST(request: Request) {
  const input = requestSchema.parse(await request.json());
  const draft = await generateRfxDraft({ prompt: input.prompt });
  return NextResponse.json(draft);
}
