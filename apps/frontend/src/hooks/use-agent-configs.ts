import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type AgentType = "challenge" | "plan" | "code" | "review" | "fix";

export interface AgentConfig {
  id: string;
  agent_type: AgentType;
  is_enabled: boolean;
  llm_model: string;
  temperature: number;
  max_tokens: number | null;
  system_prompt: string;
  trigger_on_ticket_created: boolean;
  trigger_on_ticket_moved: boolean;
  trigger_move_source_column: string | null;
  trigger_move_source_column_name: string | null;
  trigger_move_target_column: string | null;
  trigger_move_target_column_name: string | null;
  trigger_on_ticket_modified: boolean;
  trigger_on_pr_created: boolean;
  trigger_on_pr_merged: boolean;
  requires_challenge_approved: boolean;
  requires_plan_approved: boolean;
  requires_pr_created: boolean;
  requires_review_completed: boolean;
  post_move_to_column: string | null;
  post_move_to_column_name: string | null;
  post_notify_assignee: boolean;
  post_notify_creator: boolean;
  challenge_auto_approve_threshold: number | null;
  fix_severity_filter: string[];
  fix_max_iterations: number;
  created_at: string;
  updated_at: string;
}

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  context_window: number;
  input_price_per_m: number;
  output_price_per_m: number;
}

export const AGENT_INFO: Record<AgentType, { name: string; description: string }> = {
  challenge: { name: "Challenge", description: "Analyse la completude des tickets et pose des questions" },
  plan: { name: "Plan", description: "Propose un plan d'implementation decoupe par repo" },
  code: { name: "Code", description: "Genere le code et cree des Pull Requests" },
  review: { name: "Review", description: "Analyse les PRs et identifie bugs, securite, performance" },
  fix: { name: "Fix", description: "Implemente les corrections identifiees par la Review" },
};

export function useAgentConfigs(orgSlug: string, projectSlug: string) {
  return useQuery<AgentConfig[]>({
    queryKey: ["agent-configs", orgSlug, projectSlug],
    queryFn: () => api.get<AgentConfig[]>(`/orgs/${orgSlug}/projects/${projectSlug}/agents/`),
    enabled: !!orgSlug && !!projectSlug,
  });
}

export function useUpdateAgentConfig(orgSlug: string, projectSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentType, data }: { agentType: AgentType; data: Partial<AgentConfig> }) =>
      api.patch<AgentConfig>(`/orgs/${orgSlug}/projects/${projectSlug}/agents/${agentType}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-configs", orgSlug, projectSlug] });
    },
  });
}

export function useLLMModels() {
  return useQuery<LLMModel[]>({
    queryKey: ["llm-models"],
    queryFn: () => api.get<LLMModel[]>("/llm-models/"),
    staleTime: Infinity,
  });
}
