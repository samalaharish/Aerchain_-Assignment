import { describe, expect, it } from "vitest";
import { dedupeRowsByConflictKey } from "@/lib/extraction/supabase-persistence";

describe("Supabase extraction persistence", () => {
  it("deduplicates rows by the same conflict key before upsert", () => {
    const rows = [
      {
        id: "doc-a-line-01-abc",
        document_id: "doc-a",
        source_text: "Box price",
        page: null,
        source_location: "Sheet Quote cell F2"
      },
      {
        id: "doc-a-line-01-abc",
        document_id: "doc-a",
        source_text: "Box price",
        page: 1,
        source_location: "Sheet Quote cell F2",
        parser_name: "sheetjs-workbook"
      },
      {
        id: "doc-a-line-02-def",
        document_id: "doc-a",
        source_text: "Lead time",
        source_location: "Sheet Quote cell H3"
      }
    ];

    const deduped = dedupeRowsByConflictKey(rows, "id");

    expect(deduped).toHaveLength(2);
    expect(deduped.find((row) => row.id === "doc-a-line-01-abc")).toMatchObject({
      page: 1,
      parser_name: "sheetjs-workbook"
    });
  });
});
