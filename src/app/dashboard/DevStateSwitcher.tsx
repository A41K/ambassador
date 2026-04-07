"use client";

const STATES = [
  { value: "apply", label: "Apply" },
  { value: "ineligible", label: "Ineligible Region" },
  { value: "pending-checks", label: "Pending (ID check)" },
  { value: "pending", label: "Pending (review)" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "banned", label: "Application Closed" },
];

export function DevStateSwitcher({ current }: { current: string }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <span className="text-xs text-muted-foreground">dev</span>
      <select
        value={current}
        onChange={(e) => {
          const url = new URL(window.location.href);
          url.searchParams.set("devState", e.target.value);
          window.location.href = url.toString();
        }}
        className="cursor-pointer rounded bg-card text-sm text-foreground outline-none"
      >
        {STATES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
