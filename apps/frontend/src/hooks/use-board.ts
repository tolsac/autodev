import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Ticket } from "@/types";

export interface BoardColumn {
  id: string;
  name: string;
  position: number;
  color: string;
  wip_limit: number | null;
  triggers: {
    id: string;
    agent_type: string;
    trigger_mode: string;
    is_active: boolean;
  }[];
  tickets: BoardTicket[];
}

export interface BoardTicket {
  id: string;
  ticket_key: string;
  title: string;
  priority: string;
  position: number;
  column: string;
  assigned_to: { id: string; full_name: string; avatar_url: string } | null;
  labels: { id: string; name: string; color: string }[];
  challenge_status: string;
  plan_status: string;
  code_status: string;
  review_status: string;
  fix_status: string;
  estimated_complexity: string;
  created_at: string;
}

export interface BoardData {
  id: string;
  project: string;
  columns: BoardColumn[];
  created_at: string;
}

export function useBoard(orgSlug: string, projectSlug: string) {
  return useQuery<BoardData>({
    queryKey: ["board", orgSlug, projectSlug],
    queryFn: () =>
      api.get<BoardData>(
        `/orgs/${orgSlug}/projects/${projectSlug}/board/`,
      ),
    refetchInterval: 5000,
    enabled: !!orgSlug && !!projectSlug,
  });
}

export function useMoveTicket(orgSlug: string, projectSlug: string) {
  const queryClient = useQueryClient();
  const boardKey = ["board", orgSlug, projectSlug];

  return useMutation({
    mutationFn: ({
      ticketKey,
      columnId,
      position,
    }: {
      ticketKey: string;
      columnId: string;
      position: number;
    }) =>
      api.post(`/orgs/${orgSlug}/projects/${projectSlug}/tickets/${ticketKey}/move/`, {
        column_id: columnId,
        position,
      }),
    onMutate: async ({ ticketKey, columnId, position }) => {
      await queryClient.cancelQueries({ queryKey: boardKey });
      const previous = queryClient.getQueryData<BoardData>(boardKey);

      if (previous) {
        const updated = structuredClone(previous);
        let ticket: BoardTicket | undefined;

        // Remove ticket from source column
        for (const col of updated.columns) {
          const idx = col.tickets.findIndex((t) => t.ticket_key === ticketKey);
          if (idx !== -1) {
            ticket = col.tickets.splice(idx, 1)[0];
            break;
          }
        }

        // Insert into target column
        if (ticket) {
          ticket.column = columnId;
          ticket.position = position;
          const targetCol = updated.columns.find((c) => c.id === columnId);
          if (targetCol) {
            targetCol.tickets.splice(position, 0, ticket);
            targetCol.tickets.forEach((t, i) => (t.position = i));
          }
        }

        queryClient.setQueryData(boardKey, updated);
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(boardKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: boardKey });
    },
  });
}

export function useCreateTicket(orgSlug: string, projectSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      acceptance_criteria?: string;
      column: string;
      priority?: string;
      assigned_to_id?: string | null;
      label_ids?: string[];
    }) =>
      api.post<Ticket>(
        `/orgs/${orgSlug}/projects/${projectSlug}/tickets/`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", orgSlug, projectSlug],
      });
    },
  });
}
