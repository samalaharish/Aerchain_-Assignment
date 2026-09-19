"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import type { DecisionRecord, DecisionStatus } from "@/lib/domain/decision";

type DecisionActionsProps = {
  initialRecord: DecisionRecord;
};

const statusLabels: Record<DecisionStatus, string> = {
  DRAFT: "Draft",
  READY_FOR_REVIEW: "Ready for review",
  APPROVED: "Approved",
  RETURNED: "Returned"
};

export function DecisionActions({ initialRecord }: DecisionActionsProps) {
  const [record, setRecord] = useState(initialRecord);
  const [pending, setPending] = useState<DecisionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/decision")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Unable to load decision state.")))
      .then((next: DecisionRecord) => {
        if (active) setRecord(next);
      })
      .catch(() => {
        if (active) setError("Decision state is using the current page snapshot.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function update(status: DecisionStatus) {
    setPending(status);
    setError(null);
    try {
      const response = await fetch("/api/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error("Decision state could not be updated.");
      setRecord(await response.json() as DecisionRecord);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision state could not be updated.");
    } finally {
      setPending(null);
    }
  }

  const tone = record.status === "APPROVED" ? "success" : record.status === "RETURNED" ? "danger" : "warning";

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-semibold">Human approval</h2>
          <p className="mt-2 text-sm text-muted">
            This prototype records a demo decision state only. It does not award business, create purchase orders, or contact suppliers.
          </p>
        </div>
        <StatusBadge status={statusLabels[record.status]} tone={tone} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {record.status !== "READY_FOR_REVIEW" && (
          <button
            type="button"
            onClick={() => update("READY_FOR_REVIEW")}
            disabled={pending !== null}
            className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-muted hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {pending === "READY_FOR_REVIEW" ? "Updating..." : "Send for review"}
          </button>
        )}
        <button
          type="button"
          onClick={() => update("APPROVED")}
          disabled={pending !== null || record.status !== "READY_FOR_REVIEW"}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === "APPROVED" ? "Approving..." : "Approve decision"}
        </button>
        <button
          type="button"
          onClick={() => update("RETURNED")}
          disabled={pending !== null}
          className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-muted hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {pending === "RETURNED" ? "Updating..." : "Return for review"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <p className="mt-3 text-xs text-muted">Last updated {new Date(record.updatedAt).toLocaleString("en-IN")}</p>
    </div>
  );
}
