import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { formatComparisonMoney } from "@/lib/domain/comparison";
import { calculateScenarios, defaultGoals } from "@/lib/domain/scenarios";
import { buildDemoComparisonDataset } from "@/lib/extraction/comparison-source";

export const dynamic = "force-dynamic";

export default async function ScenariosPage() {
  const dataset = await buildDemoComparisonDataset();
  const scenarios = calculateScenarios(dataset);
  const splitAward = scenarios.find((scenario) => scenario.goal === "SPLIT_AWARD");

  return (
    <AppShell
      title="Scenarios"
      eyebrow="Structured sourcing goals"
      description="Choose a sourcing goal and compare deterministic scenario outputs using the comparison-ready dataset."
    >
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="text-lg font-semibold">Optimize for</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {defaultGoals.map((goal) => (
            <div key={goal.id} className="rounded-md border border-line bg-panel p-4">
              <div className="font-semibold">{goal.label}</div>
              <div className="mt-3 space-y-1 text-xs text-muted">
                <div>{goal.constraints.requireQualityPass ? "[x]" : "[ ]"} Quality requirements must be satisfied</div>
                <div>{goal.constraints.excludeCriticalExceptions ? "[x]" : "[ ]"} Exclude critical exceptions</div>
                <div>{goal.constraints.includeFreight ? "[x]" : "[ ]"} Include freight when known</div>
                <div>{goal.constraints.preferSingleSupplier ? "[x]" : "[ ]"} Prefer a single supplier</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <div className="border-b border-line p-4">
          <h2 className="font-semibold">Scenario comparison</h2>
          <p className="text-sm text-muted">Scenario costs use only comparable supplier quote cells. Unsupported lines are reported as insufficient data.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Scenario</th>
                <th className="px-4 py-3">Estimated normalized cost</th>
                <th className="px-4 py-3">Coverage</th>
                <th className="px-4 py-3">Supplier count</th>
                <th className="px-4 py-3">Unresolved issues</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((scenario) => (
                <tr key={scenario.id} className="border-t border-line align-top">
                  <td className="px-4 py-3 font-semibold">{scenario.name}</td>
                  <td className="px-4 py-3">{scenario.estimatedCost === null ? "Insufficient data" : formatComparisonMoney(scenario.estimatedCost, scenario.currency)}</td>
                  <td className="px-4 py-3">{scenario.coverageLines} / {scenario.totalLines}</td>
                  <td className="px-4 py-3">{scenario.supplierCount}</td>
                  <td className="px-4 py-3">{scenario.issues.length}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={scenario.status === "CALCULATED" ? "Calculated" : "Insufficient data"} tone={scenario.status === "CALCULATED" ? "success" : "warning"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="font-semibold">Split-award allocation preview</h2>
        <p className="mt-1 text-sm text-muted">The split award selects the lowest eligible comparable supplier per RFx line. It remains a scenario, not an approval.</p>
        {splitAward && splitAward.allocations.length > 0 ? (
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {splitAward.allocations.slice(0, 9).map((allocation) => (
              <div key={allocation.rfxLineId} className="rounded-md border border-line bg-panel p-3 text-sm">
                <div className="font-semibold">Line {allocation.lineNumber}: {allocation.vendorName}</div>
                <div className="mt-1 text-xs text-muted">{formatComparisonMoney(allocation.landedTotal, "INR")}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Not enough comparable data to calculate this scenario.</p>
        )}
      </section>
    </AppShell>
  );
}
