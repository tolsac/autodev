import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ProjectListItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  ticket_prefix: string;
  is_archived: boolean;
  ticket_count: number;
  member_count: number;
  repo_count: number;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreatePayload {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  ticket_prefix?: string;
  default_target_branch?: string;
  branch_naming_template?: string;
  pr_title_template?: string;
  llm_model?: string;
  agent_global_instructions?: string;
  repository_ids?: string[];
}

export function useOrgProjects(orgSlug: string, includeArchived?: boolean) {
  return useQuery<ProjectListItem[]>({
    queryKey: ["org-projects", orgSlug, includeArchived],
    queryFn: async () => {
      const params = includeArchived ? "?include_archived=true" : "";
      const data = await api.get<any>(`/orgs/${orgSlug}/projects/${params}`);
      return data.results ?? data;
    },
    enabled: !!orgSlug,
  });
}

export function useCreateProject(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectCreatePayload) =>
      api.post<ProjectListItem>(`/orgs/${orgSlug}/projects/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-projects", orgSlug] });
      qc.invalidateQueries({ queryKey: ["projects", orgSlug] });
    },
  });
}
