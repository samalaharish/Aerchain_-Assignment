import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { rfxDraftSchema, type RfxDraft } from "@/lib/rfx/copilot";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const defaultDraftPath = path.join(process.cwd(), ".cache", "reviewed-rfx-draft.json");
const stateKey = "reviewed-rfx-draft";

type StoreOptions = {
  filePath?: string;
};

export async function readReviewedRfxDraft(options: StoreOptions = {}): Promise<RfxDraft | null> {
  if (!options.filePath) {
    const client = getSupabaseServerClient();
    if (client) {
      const draft = await client.getState<RfxDraft>(stateKey);
      return draft ? rfxDraftSchema.parse(draft) : null;
    }
  }

  try {
    const raw = await readFile(options.filePath ?? defaultDraftPath, "utf8");
    return rfxDraftSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function writeReviewedRfxDraft(draft: RfxDraft, options: StoreOptions = {}): Promise<RfxDraft> {
  const parsed = rfxDraftSchema.parse(draft);
  if (!options.filePath) {
    const client = getSupabaseServerClient();
    if (client) {
      await client.upsertState(stateKey, parsed);
      return parsed;
    }
  }

  const filePath = options.filePath ?? defaultDraftPath;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(parsed, null, 2), "utf8");
  return parsed;
}
