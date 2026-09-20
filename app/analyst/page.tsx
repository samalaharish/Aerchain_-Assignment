import { AppShell } from "@/components/app-shell";
import { AnalystChat } from "@/components/analyst-chat";

export const dynamic = "force-dynamic";

export default function AnalystPage() {
  return (
    <AppShell
      title="Procurement Analyst"
      eyebrow="Tool-backed analysis"
      description="Ask questions about this RFx, supplier responses, comparison data, exceptions, and scenarios. Calculations come from deterministic tools; AI explains when configured."
    >
      <AnalystChat />
    </AppShell>
  );
}
