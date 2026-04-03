import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Organization, Project } from "@/types";

interface PaginatedResponse<T> {
  count: number;
  results: T[];
}

export function useOrgs() {
  return useQuery<Organization[]>({
    queryKey: ["orgs"],
    queryFn: async () => {
      const data = await api.get<PaginatedResponse<Organization>>("/orgs/");
      return data.results;
    },
  });
}

export function useProjects(orgSlug: string | null | undefined) {
  return useQuery<Project[]>({
    queryKey: ["projects", orgSlug],
    queryFn: async () => {
      const data = await api.get<PaginatedResponse<Project>>(
        `/orgs/${orgSlug}/projects/`,
      );
      return data.results;
    },
    enabled: !!orgSlug,
  });
}
