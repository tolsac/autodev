import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Project } from "@/types";
import { useBoard } from "@/hooks/use-board";
import BoardToolbar from "@/components/board/BoardToolbar";
import BoardView from "@/components/board/BoardView";
import TicketCreateModal from "@/components/tickets/TicketCreateModal";
import TicketDetailModal from "@/components/tickets/TicketDetailModal";

export default function BoardPage() {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createColumnId, setCreateColumnId] = useState<string | undefined>();
  const [detailTicketKey, setDetailTicketKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery<Project>({
    queryKey: ["project", orgSlug, projectSlug],
    queryFn: () => api.get<Project>(`/orgs/${orgSlug}/projects/${projectSlug}/`),
    enabled: !!orgSlug && !!projectSlug,
  });

  const { data: board, isLoading: boardLoading, error: boardError } = useBoard(orgSlug!, projectSlug!);

  const filteredBoard = useMemo(() => {
    if (!board || !searchQuery.trim()) return board;
    const q = searchQuery.toLowerCase();
    return {
      ...board,
      columns: board.columns.map((col) => ({
        ...col,
        tickets: col.tickets.filter(
          (t) => t.title.toLowerCase().includes(q) || t.ticket_key.toLowerCase().includes(q),
        ),
      })),
    };
  }, [board, searchQuery]);

  if (projectLoading || boardLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Chargement...</div>;
  }

  if (projectError || boardError || !project || !filteredBoard) {
    return <div className="flex h-full items-center justify-center text-destructive">Impossible de charger le board.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <BoardToolbar project={project} searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <div className="flex-1 overflow-hidden bg-[#09090f]">
        <BoardView
          board={filteredBoard}
          orgSlug={orgSlug!}
          projectSlug={projectSlug!}
          onAddTicket={(columnId) => {
            setCreateColumnId(columnId);
            setCreateOpen(true);
          }}
          onTicketClick={(ticketKey) => setDetailTicketKey(ticketKey)}
        />
      </div>

      {/* Create ticket modal */}
      <TicketCreateModal
        orgSlug={orgSlug!}
        projectSlug={projectSlug!}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultColumnId={createColumnId}
        onSuccess={() => setCreateOpen(false)}
      />

      {/* Detail ticket modal */}
      <TicketDetailModal
        orgSlug={orgSlug!}
        projectSlug={projectSlug!}
        ticketKey={detailTicketKey}
        onClose={() => setDetailTicketKey(null)}
      />
    </div>
  );
}
