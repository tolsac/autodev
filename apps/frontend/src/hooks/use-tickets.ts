import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface TicketFilters {
  column?: string;
  assigned_to?: string;
  priority?: string;
  label?: string;
  search?: string;
  ordering?: string;
}

export interface TicketListItem {
  id: string;
  ticket_key: string;
  title: string;
  priority: string;
  position: number;
  column: string;
  column_name: string;
  assigned_to: { id: string; full_name: string; avatar_url: string } | null;
  created_by: { id: string; full_name: string } | null;
  labels: { id: string; name: string; color: string }[];
  challenge_status: string;
  plan_status: string;
  code_status: string;
  review_status: string;
  fix_status: string;
  estimated_complexity: string;
  created_at: string;
  updated_at: string;
}

export interface TicketDetail extends Omit<TicketListItem, "column" | "column_name"> {
  description: string;
  acceptance_criteria: string;
  column: { id: string; name: string; color: string };
  project: string;
  impacted_repos: { id: string; name: string; full_name: string; html_url: string }[];
  comments: CommentItem[];
}

export interface CommentItem {
  id: string;
  author: { id: string; full_name: string; avatar_url: string } | null;
  author_name: string | null;
  author_type: "human" | "agent";
  agent_type: string | null;
  body: string;
  is_question: boolean;
  is_resolved: boolean;
  parent: string | null;
  created_at: string;
  replies: CommentItem[];
}

interface TicketListResponse {
  results: TicketListItem[];
  count: number;
}

export function useTicketsList(
  orgSlug: string,
  projectSlug: string,
  filters: TicketFilters,
) {
  return useQuery<TicketListResponse>({
    queryKey: ["tickets", orgSlug, projectSlug, filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.column) params.set("column", filters.column);
      if (filters.assigned_to) params.set("assigned_to", filters.assigned_to);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.label) params.set("label", filters.label);
      if (filters.search) params.set("search", filters.search);
      if (filters.ordering) params.set("ordering", filters.ordering);
      const qs = params.toString();
      return api.get<TicketListResponse>(
        `/orgs/${orgSlug}/projects/${projectSlug}/tickets/${qs ? `?${qs}` : ""}`,
      );
    },
    staleTime: 30_000,
    enabled: !!orgSlug && !!projectSlug,
  });
}

export function useTicketDetail(
  orgSlug: string,
  projectSlug: string,
  ticketKey: string | null,
) {
  return useQuery<TicketDetail>({
    queryKey: ["ticket", orgSlug, projectSlug, ticketKey],
    queryFn: () =>
      api.get<TicketDetail>(
        `/orgs/${orgSlug}/projects/${projectSlug}/tickets/${ticketKey}/`,
      ),
    enabled: !!orgSlug && !!projectSlug && !!ticketKey,
  });
}
