const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  none: { color: "#6B7280", label: "Aucune" },
  low: { color: "#10B981", label: "Low" },
  medium: { color: "#F59E0B", label: "Medium" },
  high: { color: "#F97316", label: "High" },
  urgent: { color: "#EF4444", label: "Urgent" },
};

export default function PriorityIndicator({
  priority,
  showLabel = false,
}: {
  priority: string;
  showLabel?: boolean;
}) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.none;

  return (
    <div className="flex items-center gap-1.5" title={config.label}>
      <svg width={showLabel ? 12 : 10} height={showLabel ? 12 : 10} viewBox="0 0 12 12">
        <circle cx="6" cy="6" r="5" fill={config.color} />
      </svg>
      {showLabel && (
        <span className="text-xs text-foreground">{config.label}</span>
      )}
    </div>
  );
}
