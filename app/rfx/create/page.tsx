import { AppShell } from "@/components/app-shell";
import { RfxCopilot } from "@/components/rfx-copilot";

export const dynamic = "force-dynamic";

export default function CreateRfxPage() {
  return (
    <AppShell
      title="Create RFx"
      eyebrow="RFx Copilot"
      description="Turn a buyer's natural-language sourcing need into a structured RFx draft for review."
    >
      <RfxCopilot />
    </AppShell>
  );
}
