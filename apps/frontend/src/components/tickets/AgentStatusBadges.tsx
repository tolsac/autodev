const AGENTS = [
  { key: "challenge_status", label: "Challenge", short: "C" },
  { key: "plan_status", label: "Plan", short: "P" },
  { key: "code_status", label: "Code", short: "<>" },
  { key: "review_status", label: "Review", short: "R" },
  { key: "fix_status", label: "Fix", short: "F" },
] as const;

const STATUS_STYLE: Record<string, { bg: string; fg: string; spinning?: boolean }> = {
  in_progress: { bg: "#3B82F620", fg: "#3B82F6", spinning: true },
  waiting_for_input: { bg: "#F59E0B20", fg: "#F59E0B" },
  approved: { bg: "#10B98120", fg: "#10B981" },
  generated: { bg: "#3B82F620", fg: "#3B82F6" },
  pr_created: { bg: "#8B5CF620", fg: "#8B5CF6" },
  pr_merged: { bg: "#10B98120", fg: "#10B981" },
  fixed: { bg: "#10B98120", fg: "#10B981" },
  changes_requested: { bg: "#F59E0B20", fg: "#F59E0B" },
  failed: { bg: "#EF444420", fg: "#EF4444" },
  rejected: { bg: "#EF444420", fg: "#EF4444" },
};

export default function AgentStatusBadges({
  statuses,
  showLabels = false,
}: {
  statuses: Record<string, string>;
  showLabels?: boolean;
}) {
  const active = AGENTS.filter((a) => statuses[a.key] !== "not_started");
  if (active.length === 0) return null;

  return (
    <div className="flex gap-1">
      {active.map((agent) => {
        const status = statuses[agent.key];
        const style = STATUS_STYLE[status] ?? { bg: "#6B728020", fg: "#6B7280" };
        return (
          <span
            key={agent.key}
            className={`inline-flex h-5 items-center justify-center rounded text-[9px] font-bold ${showLabels ? "gap-1 px-1.5" : "w-5"}`}
            style={{ backgroundColor: style.bg, color: style.fg }}
            title={`${agent.label}: ${status.replace(/_/g, " ")}`}
          >
            {style.spinning && (
              <svg className="size-2.5 animate-spin" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                <path d="M6 1a5 5 0 0 1 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
            {agent.short}
            {showLabels && (
              <span className="text-[10px] font-normal opacity-80">
                {status.replace(/_/g, " ")}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
