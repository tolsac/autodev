import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BoardColumn } from "@/hooks/use-board";

export default function SettingsBoard({ orgSlug, projectSlug }: { orgSlug: string; projectSlug: string }) {
  const { data: columns, isLoading } = useQuery<BoardColumn[]>({
    queryKey: ["board-columns", orgSlug, projectSlug],
    queryFn: async () => {
      const board = await api.get<{ columns: BoardColumn[] }>(`/orgs/${orgSlug}/projects/${projectSlug}/board/`);
      return board.columns;
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Chargement...</div>;

  return (
    <div className="max-w-2xl space-y-4">
      <h3 className="text-sm font-medium text-foreground">Colonnes du board</h3>
      <div className="space-y-1">
        {columns?.map((col) => (
          <div key={col.id} className="flex items-center gap-3 rounded-lg border border-white/5 px-4 py-3">
            <span className="text-[#8b8b9e] cursor-grab">&#8801;</span>
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: col.color }} />
            <span className="flex-1 text-sm text-foreground">{col.name}</span>
            <span className="text-xs text-[#555566]">WIP: {col.wip_limit ?? "—"}</span>
            <span className="text-xs text-[#555566]">{col.triggers.length} trigger{col.triggers.length !== 1 ? "s" : ""}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#8b8b9e]">Le reordonnement et la configuration des triggers sont a venir.</p>
    </div>
  );
}
