import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BoardColumn } from "@/hooks/use-board";

interface MemberItem {
  id: string;
  user: { id: string; full_name: string; email: string; avatar_url: string };
  role: string;
}

interface LabelItem {
  id: string;
  name: string;
  color: string;
}

export function useProjectColumns(orgSlug: string, projectSlug: string) {
  return useQuery<BoardColumn[]>({
    queryKey: ["board-columns", orgSlug, projectSlug],
    queryFn: async () => {
      const board = await api.get<{ columns: BoardColumn[] }>(
        `/orgs/${orgSlug}/projects/${projectSlug}/board/`,
      );
      return board.columns;
    },
    enabled: !!orgSlug && !!projectSlug,
  });
}

export function useProjectMembers(orgSlug: string, projectSlug: string) {
  return useQuery<MemberItem[]>({
    queryKey: ["project-members", orgSlug, projectSlug],
    queryFn: () =>
      api.get<MemberItem[]>(`/orgs/${orgSlug}/projects/${projectSlug}/members/`),
    enabled: !!orgSlug && !!projectSlug,
  });
}

export function useProjectLabels(orgSlug: string, projectSlug: string) {
  return useQuery<LabelItem[]>({
    queryKey: ["project-labels", orgSlug, projectSlug],
    queryFn: () =>
      api.get<LabelItem[]>(`/orgs/${orgSlug}/projects/${projectSlug}/labels/`),
    enabled: !!orgSlug && !!projectSlug,
  });
}
