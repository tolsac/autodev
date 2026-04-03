import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

export interface OrgSettings {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  timezone: string;
  default_notification_channel: string;
  member_count: number;
  project_count: number;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  user: { id: string; full_name: string; email: string; avatar_url: string };
  role: string;
  joined_at: string;
}

export interface OrgInvitation {
  id: string;
  email: string;
  role: string;
  is_guest: boolean;
  guest_project_role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

export interface AuditEntry {
  id: string;
  user: { id: string; full_name: string } | null;
  user_name: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface BillingInfo {
  id: string;
  plan: string;
  max_projects: number;
  max_members: number;
  max_ai_runs_per_month: number;
  current_ai_runs_count: number;
  current_period_start: string | null;
  current_period_end: string | null;
}

export function useOrgSettings(orgSlug: string) {
  return useQuery<OrgSettings>({
    queryKey: ["org-settings", orgSlug],
    queryFn: () => api.get<OrgSettings>(`/orgs/${orgSlug}/settings/`),
    enabled: !!orgSlug,
  });
}

export function useUpdateOrgSettings(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<OrgSettings>) =>
      api.patch<OrgSettings>(`/orgs/${orgSlug}/settings/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-settings", orgSlug] });
      qc.invalidateQueries({ queryKey: ["orgs"] });
    },
  });
}

export function useOrgMembers(orgSlug: string) {
  return useQuery<OrgMember[]>({
    queryKey: ["org-members", orgSlug],
    queryFn: () => api.get<OrgMember[]>(`/orgs/${orgSlug}/members/`),
    enabled: !!orgSlug,
  });
}

export function useOrgInvitations(orgSlug: string) {
  return useQuery<OrgInvitation[]>({
    queryKey: ["org-invitations", orgSlug],
    queryFn: () => api.get<OrgInvitation[]>(`/orgs/${orgSlug}/invitations/`),
    enabled: !!orgSlug,
  });
}

export function useCreateInvitation(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; role: string; is_guest?: boolean }) =>
      api.post(`/orgs/${orgSlug}/invitations/`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-invitations", orgSlug] }),
  });
}

export function useUpdateMemberRole(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/orgs/${orgSlug}/members/${userId}/`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", orgSlug] }),
  });
}

export function useRemoveMember(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/orgs/${orgSlug}/members/${userId}/remove/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", orgSlug] }),
  });
}

export function useBilling(orgSlug: string) {
  return useQuery<BillingInfo>({
    queryKey: ["billing", orgSlug],
    queryFn: () => api.get<BillingInfo>(`/orgs/${orgSlug}/billing/`),
    enabled: !!orgSlug,
  });
}

export function useAuditLog(orgSlug: string, filters?: Record<string, string>) {
  return useQuery<AuditEntry[]>({
    queryKey: ["audit-log", orgSlug, filters],
    queryFn: () => {
      const params = new URLSearchParams(filters);
      const qs = params.toString();
      return api.get<AuditEntry[]>(`/orgs/${orgSlug}/audit-log/${qs ? `?${qs}` : ""}`);
    },
    enabled: !!orgSlug,
  });
}

export function useDeleteOrg(orgSlug: string) {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (confirmName: string) =>
      api.post(`/orgs/${orgSlug}/delete/`, { confirm_name: confirmName }),
    onSuccess: () => {
      localStorage.removeItem("currentOrg");
      navigate("/auth/login");
    },
  });
}
