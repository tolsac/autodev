import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

export interface ProjectSettings {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  ticket_prefix: string;
  ticket_counter: number;
  is_archived: boolean;
  archived_at: string | null;
  default_target_branch: string;
  branch_naming_template: string;
  pr_title_template: string;
  pr_body_template: string;
  llm_model: string;
  agent_global_instructions: string;
  agent_custom_instructions: string;
  agent_challenge_instructions: string;
  agent_plan_instructions: string;
  agent_code_instructions: string;
  agent_review_instructions: string;
  agent_fix_instructions: string;
  challenge_auto_approve_threshold: number;
  fix_severity_filter: string[];
  fix_max_iterations: number;
  notification_channel_override: string | null;
  notify_agent_questions: boolean;
  notify_plan_generated: boolean;
  notify_pr_created: boolean;
  notify_review_completed: boolean;
  notify_fix_applied: boolean;
  created_at: string;
  updated_at: string;
}

export function useProjectSettings(orgSlug: string, projectSlug: string) {
  return useQuery<ProjectSettings>({
    queryKey: ["project-settings", orgSlug, projectSlug],
    queryFn: () => api.get<ProjectSettings>(`/orgs/${orgSlug}/projects/${projectSlug}/settings/`),
    enabled: !!orgSlug && !!projectSlug,
  });
}

export function useUpdateProjectSettings(orgSlug: string, projectSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ProjectSettings>) =>
      api.patch<ProjectSettings>(`/orgs/${orgSlug}/projects/${projectSlug}/settings/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-settings", orgSlug, projectSlug] });
      qc.invalidateQueries({ queryKey: ["projects", orgSlug] });
    },
  });
}

export function useArchiveProject(orgSlug: string, projectSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (archive: boolean) =>
      api.post(`/orgs/${orgSlug}/projects/${projectSlug}/archive/`, { is_archived: archive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-settings", orgSlug, projectSlug] });
      qc.invalidateQueries({ queryKey: ["projects", orgSlug] });
    },
  });
}

export function useDeleteProject(orgSlug: string, projectSlug: string) {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (confirmName: string) =>
      api.post(`/orgs/${orgSlug}/projects/${projectSlug}/delete/`, { confirm_name: confirmName }),
    onSuccess: () => navigate(`/${orgSlug}`),
  });
}
