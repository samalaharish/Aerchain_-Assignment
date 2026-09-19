import * as XLSX from "xlsx";
import type { DocumentParser, ParsedRow, ParsedTable, SourceLocation } from "@/lib/ingestion/types";

export const excelParser: DocumentParser = {
  name: "sheetjs-workbook",
  version: "v1",
  supports: ["XLSX", "XLS"],
  async parse({ metadata, bytes }) {
    const workbook = XLSX.read(bytes, { type: "array", cellFormula: false, cellHTML: false, cellStyles: false });
    const tables: ParsedTable[] = [];
    const sourceLocations: SourceLocation[] = [];
    const textParts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
      const rows: ParsedRow[] = [];

      for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
        const cells = [];
        const rowText: string[] = [];

        for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
          const value = normalizeCellValue(sheet[cellAddress]?.v ?? null);
          const location = sourceLocation(metadata.documentId, metadata.contentHash, sheetName, rowIndex + 1, colIndex + 1, cellAddress, value);
          sourceLocations.push(location);
          cells.push({ value, location });
          if (value !== null) rowText.push(String(value));
        }

        const rowLocation = sourceLocation(metadata.documentId, metadata.contentHash, sheetName, rowIndex + 1, 1, `row ${rowIndex + 1}`, rowText.join(" | "));
        rows.push({ rowNumber: rowIndex + 1, cells, location: rowLocation });
        if (rowText.length > 0) textParts.push(`${sheetName} row ${rowIndex + 1}: ${rowText.join(" | ")}`);
      }

      tables.push({
        tableId: `${metadata.documentId}-${sheetName}`,
        title: sheetName,
        rows,
        location: sourceLocation(metadata.documentId, metadata.contentHash, sheetName, 1, 1, sheetName, sheetName)
      });
    }

    return {
      documentId: metadata.documentId,
      contentHash: metadata.contentHash,
      sourceType: metadata.sourceType,
      parserName: excelParser.name,
      parserVersion: excelParser.version,
      processingStatus: "PARSED",
      extractedText: textParts.join("\n"),
      pages: [],
      tables,
      metadata: {
        sheetCount: workbook.SheetNames.length,
        sheetNames: workbook.SheetNames.join(", ")
      },
      sourceLocations,
      warnings: []
    };
  }
};

function normalizeCellValue(value: unknown): string | number | boolean | null {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null;
}

function sourceLocation(
  documentId: string,
  contentHash: string,
  sheet: string,
  row: number,
  column: number,
  cell: string,
  value: string | number | boolean | null
): SourceLocation {
  return {
    documentId,
    sheet,
    row,
    column,
    cell,
    text: value === null ? undefined : String(value),
    sourceLocation: `${sheet}!${cell}`,
    parser: `${excelParser.name}-${excelParser.version}`,
    contentHash
  };
}
