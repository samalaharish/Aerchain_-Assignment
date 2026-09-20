import { mkdtemp, readFile, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { demoMutableStateKeys, resetLocalDemoWorkflowState, type DemoStateFilePaths } from "@/lib/demo/reset";
import { procurementEvent } from "@/lib/fixtures/procurement-event";

describe("demo reset", () => {
  it("clears mutable local workflow state without touching seeded procurement data", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aerchain-reset-"));
    const filePaths = Object.fromEntries(
      demoMutableStateKeys.map((key) => [key, path.join(root, `${key}.json`)])
    ) as DemoStateFilePaths;

    await Promise.all(
      demoMutableStateKeys.map((key) => writeFile(filePaths[key], JSON.stringify({ key }), "utf8"))
    );

    await resetLocalDemoWorkflowState(filePaths);

    for (const key of demoMutableStateKeys) {
      await expect(readFile(filePaths[key], "utf8")).rejects.toThrow();
    }

    expect(procurementEvent.lineItems).toHaveLength(30);
    expect(procurementEvent.vendors).toHaveLength(5);
    expect(procurementEvent.documents).toHaveLength(5);
  });
});
