"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DemoResetButton() {
  const router = useRouter();
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resetDemo() {
    const confirmed = window.confirm(
      "Reset the demo workflow? This clears the current buyer session and returns the app to the starting RFx Copilot state."
    );
    if (!confirmed || isResetting) return;

    setIsResetting(true);
    setError(null);
    try {
      const response = await fetch("/api/demo-reset", { method: "POST" });
      if (!response.ok) throw new Error(`Reset failed with ${response.status}`);
      window.sessionStorage.removeItem("aerchain-analyst-history");
      window.localStorage.removeItem("aerchain-analyst-history");
      router.push("/");
      router.refresh();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Reset failed.");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-muted hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isResetting}
        onClick={() => void resetDemo()}
      >
        {isResetting ? "Resetting..." : "Reset demo"}
      </button>
      {error && <span className="text-xs font-medium text-red-700">{error}</span>}
    </div>
  );
}
