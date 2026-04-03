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

export interface ProjectRepoItem {
  id: string;
  repository: {
    id: string;
    name: string;
    full_name: string;
    html_url: string;
    indexing_status: string;
  };
  is_default: boolean;
  target_branch_override: string;
}

export function useProjectRepos(orgSlug: string, projectSlug: string) {
  return useQuery<ProjectRepoItem[]>({
    queryKey: ["project-repos", orgSlug, projectSlug],
    queryFn: async () => {
      const data = await api.get<any>(`/orgs/${orgSlug}/projects/${projectSlug}/repositories/`);
      return data.results ?? data;
    },
    enabled: !!orgSlug && !!projectSlug,
  });
}
