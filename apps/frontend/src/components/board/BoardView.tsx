import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { BoardData, BoardTicket } from "@/hooks/use-board";
import { useMoveTicket } from "@/hooks/use-board";
import BoardColumn from "./BoardColumn";
import TicketCard from "./TicketCard";

export default function BoardView({
  board,
  orgSlug,
  projectSlug,
  onAddTicket,
  onTicketClick,
}: {
  board: BoardData;
  orgSlug: string;
  projectSlug: string;
  onAddTicket?: (columnId: string) => void;
  onTicketClick?: (ticketKey: string) => void;
}) {
  const [activeTicket, setActiveTicket] = useState<BoardTicket | null>(null);
  const moveTicket = useMoveTicket(orgSlug, projectSlug);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const ticket = event.active.data.current?.ticket as BoardTicket | undefined;
    if (ticket) setActiveTicket(ticket);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTicket(null);
      const { active, over } = event;
      if (!over) return;

      const ticketData = active.data.current?.ticket as BoardTicket | undefined;
      if (!ticketData) return;

      let targetColumnId = over.id as string;
      let targetPosition = 0;

      const overColumn = board.columns.find((c) => c.id === over.id);
      if (!overColumn) {
        for (const col of board.columns) {
          const ticketIdx = col.tickets.findIndex((t) => t.id === over.id);
          if (ticketIdx !== -1) {
            targetColumnId = col.id;
            targetPosition = ticketIdx;
            break;
          }
        }
      } else {
        targetPosition = overColumn.tickets.length;
      }

      if (ticketData.column === targetColumnId && ticketData.position === targetPosition) return;

      moveTicket.mutate({
        ticketKey: ticketData.ticket_key,
        columnId: targetColumnId,
        position: targetPosition,
      });
    },
    [board, moveTicket],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {board.columns.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            orgSlug={orgSlug}
            projectSlug={projectSlug}
            onAddTicket={onAddTicket}
            onTicketClick={onTicketClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTicket && (
          <div className="w-72 opacity-90">
            <TicketCard ticket={activeTicket} orgSlug={orgSlug} projectSlug={projectSlug} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
