import { NextResponse } from "next/server";
import { runExtractionApi } from "@/lib/extraction/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    documentId: string;
  };
};

export async function POST(_request: Request, context: RouteContext) {
  const response = await runExtractionApi(context.params.documentId);

  if (!response.ok) {
    return NextResponse.json(response, { status: 404 });
  }

  return NextResponse.json(response, { status: 200 });
}
