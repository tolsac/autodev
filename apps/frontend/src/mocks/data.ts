import type { User, Organization, Project } from "@/types";

export const mockUser: User = {
  id: "usr-1",
  email: "camille@acme.com",
  full_name: "Camille Dupont",
  avatar_url: "",
  preferred_language: "fr",
  preferred_notification_channel: "in_app",
};

export const mockOrgs: Organization[] = [
  { id: "org-1", name: "Acme Corp", slug: "acme-corp", logo_url: "", created_at: "2024-01-01" },
  { id: "org-2", name: "Side Project", slug: "side-project", logo_url: "", created_at: "2024-06-01" },
];

export const mockProjects: Project[] = [
  { id: "proj-1", name: "Autodev API", slug: "autodev-api", description: "", icon: "", color: "#7F77DD", ticket_prefix: "AD", organization: "org-1", created_by: "usr-1", created_at: "2024-01-15", updated_at: "2024-03-01" },
  { id: "proj-2", name: "Autodev Front", slug: "autodev-front", description: "", icon: "", color: "#378ADD", ticket_prefix: "AF", organization: "org-1", created_by: "usr-1", created_at: "2024-02-01", updated_at: "2024-03-01" },
  { id: "proj-3", name: "Landing Page", slug: "landing-page", description: "", icon: "", color: "#1D9E75", ticket_prefix: "LP", organization: "org-1", created_by: "usr-1", created_at: "2024-03-01", updated_at: "2024-03-15" },
];
