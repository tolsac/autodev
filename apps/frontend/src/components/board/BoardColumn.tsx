import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { BoardColumn as BoardColumnType } from "@/hooks/use-board";
import TicketCard from "./TicketCard";

export default function BoardColumn({
  column,
  orgSlug,
  projectSlug,
  onAddTicket,
  onTicketClick,
}: {
  column: BoardColumnType;
  orgSlug: string;
  projectSlug: string;
  onAddTicket?: (columnId: string) => void;
  onTicketClick?: (ticketKey: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const hasAutoTrigger = column.triggers.some(
    (t) => t.trigger_mode === "auto" && t.is_active,
  );
  const ticketIds = column.tickets.map((t) => t.id);

  return (
    <div className="flex h-full w-72 flex-shrink-0 flex-col rounded-xl bg-[#0c0c14]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8b8b9e]">
            {column.name}
          </h3>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/5 px-1.5 text-[10px] font-medium text-[#8b8b9e]">
            {column.tickets.length}
          </span>
          {hasAutoTrigger && (
            <span className="text-[10px]" title="Auto-trigger">&#129302;</span>
          )}
        </div>
        <button className="text-[#8b8b9e] hover:text-foreground">
          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 transition-colors ${
          isOver ? "bg-primary/5" : ""
        }`}
      >
        <SortableContext items={ticketIds} strategy={verticalListSortingStrategy}>
          {column.tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              onClick={onTicketClick ? () => onTicketClick(ticket.ticket_key) : undefined}
            />
          ))}
        </SortableContext>
      </div>

      {/* Add ticket button at bottom */}
      <button
        onClick={() => onAddTicket?.(column.id)}
        className="flex items-center justify-center gap-1.5 border-t border-white/5 px-3 py-2.5 text-xs text-[#8b8b9e] transition-colors hover:text-foreground"
      >
        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add ticket
      </button>
    </div>
  );
}
