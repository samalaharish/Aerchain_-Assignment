import { docxParser } from "@/lib/ingestion/parsers/docx-parser";
import { excelParser } from "@/lib/ingestion/parsers/excel-parser";
import { imageParser } from "@/lib/ingestion/parsers/image-parser";
import { pdfParser } from "@/lib/ingestion/parsers/pdf-parser";
import { textParser } from "@/lib/ingestion/parsers/text-parser";
import type { DocumentSourceType } from "@/lib/domain/types";
import type { DocumentParser } from "@/lib/ingestion/types";

export const parsers: DocumentParser[] = [excelParser, pdfParser, docxParser, textParser, imageParser];

export function getParserForSourceType(sourceType: DocumentSourceType): DocumentParser | null {
  return parsers.find((parser) => parser.supports.includes(sourceType)) ?? null;
}
