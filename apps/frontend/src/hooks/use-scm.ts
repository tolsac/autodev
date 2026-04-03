import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface SCMConnectionItem {
  id: string;
  provider_type: string;
  external_org_name: string;
  external_org_id: string;
  created_at: string;
}

export interface OrgRepo {
  id: string;
  name: string;
  full_name: string;
  provider_type: string;
  default_branch: string;
  html_url: string;
  indexing_status: string;
  last_indexed_at: string | null;
  created_at: string;
}

export interface AvailableRepo {
  external_id: string;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  language: string | null;
  description: string;
  updated_at: string | null;
}

export function useSCMConnections(orgSlug: string) {
  return useQuery<SCMConnectionItem[]>({
    queryKey: ["scm-connections", orgSlug],
    queryFn: async () => {
      const data = await api.get<any>(`/orgs/${orgSlug}/scm-connections/`);
      return data.results ?? data;
    },
    enabled: !!orgSlug,
  });
}

export function useOrgRepositories(orgSlug: string, hasPolling?: boolean) {
  return useQuery<OrgRepo[]>({
    queryKey: ["org-repositories", orgSlug],
    queryFn: async () => {
      const data = await api.get<any>(`/orgs/${orgSlug}/repositories/`);
      return data.results ?? data;
    },
    enabled: !!orgSlug,
    refetchInterval: hasPolling ? 5000 : false,
  });
}

export function useStartGitHubInstall(orgSlug: string) {
  return useMutation({
    mutationFn: () => api.post<{ redirect_url: string }>(`/orgs/${orgSlug}/scm-connections/github/install/`),
    onSuccess: (data) => {
      window.location.href = data.redirect_url;
    },
  });
}

export function useAvailableRepos(orgSlug: string, connectionId: string | null) {
  return useQuery<{ total_on_github: number; already_imported: number; available: AvailableRepo[] }>({
    queryKey: ["available-repos", orgSlug, connectionId],
    queryFn: () => api.get(`/orgs/${orgSlug}/scm-connections/${connectionId}/available-repos/`),
    enabled: !!orgSlug && !!connectionId,
  });
}

export function useImportRepositories(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { scm_connection_id: string; external_ids: string[] }) =>
      api.post(`/orgs/${orgSlug}/repositories/import/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-repositories", orgSlug] });
      qc.invalidateQueries({ queryKey: ["available-repos", orgSlug] });
    },
  });
}

export function useDisconnectSCM(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      api.delete(`/orgs/${orgSlug}/scm-connections/${connectionId}/disconnect/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scm-connections", orgSlug] });
      qc.invalidateQueries({ queryKey: ["org-repositories", orgSlug] });
    },
  });
}
