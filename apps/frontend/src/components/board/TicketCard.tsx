import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BoardTicket } from "@/hooks/use-board";

const PRIORITY_COLORS: Record<string, string> = {
  none: "",
  low: "bg-green-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

const AGENT_STYLE: Record<string, { bg: string; fg: string }> = {
  approved: { bg: "#10B98118", fg: "#10B981" },
  generated: { bg: "#10B98118", fg: "#10B981" },
  pr_merged: { bg: "#10B98118", fg: "#10B981" },
  fixed: { bg: "#10B98118", fg: "#10B981" },
  in_progress: { bg: "#F59E0B18", fg: "#F59E0B" },
  waiting_for_input: { bg: "#3B82F618", fg: "#3B82F6" },
  failed: { bg: "#EF444418", fg: "#EF4444" },
  rejected: { bg: "#EF444418", fg: "#EF4444" },
};

const AGENT_LABELS: Record<string, string> = {
  challenge: "C", plan: "P", code: "<>", review: "R", fix: "F",
};

export default function TicketCard({
  ticket,
  onClick,
}: {
  ticket: BoardTicket;
  orgSlug?: string;
  projectSlug?: string;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ticket.id, data: { ticket } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const agents = [
    { type: "challenge", status: ticket.challenge_status },
    { type: "plan", status: ticket.plan_status },
    { type: "code", status: ticket.code_status },
    { type: "review", status: ticket.review_status },
    { type: "fix", status: ticket.fix_status },
  ].filter((a) => a.status !== "not_started");

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`cursor-pointer rounded-lg border border-white/5 bg-[#13131d] p-3 transition-all hover:border-white/10 hover:shadow-lg ${
        isDragging ? "z-50 opacity-70 shadow-2xl ring-1 ring-primary/30" : ""
      }`}
    >
      {/* Top row: key + priority + assignee */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#8b8b9e]">{ticket.ticket_key}</span>
          {ticket.priority !== "none" && PRIORITY_COLORS[ticket.priority] && (
            <span className={`h-2 w-2 rounded-full ${PRIORITY_COLORS[ticket.priority]}`} />
          )}
        </div>
        {ticket.assigned_to && (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-medium text-primary"
            title={ticket.assigned_to.full_name}
          >
            {ticket.assigned_to.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Title */}
      <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
        {ticket.title}
      </p>

      {/* Labels */}
      {ticket.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {ticket.labels.map((label) => (
            <span
              key={label.id}
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: label.color + "20", color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Agent statuses */}
      {agents.length > 0 && (
        <div className="mt-2 flex gap-1">
          {agents.map((a) => {
            const s = AGENT_STYLE[a.status] ?? { bg: "#6B728018", fg: "#6B7280" };
            return (
              <span
                key={a.type}
                className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold"
                style={{ backgroundColor: s.bg, color: s.fg }}
                title={`${a.type}: ${a.status.replace(/_/g, " ")}`}
              >
                {AGENT_LABELS[a.type]}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
