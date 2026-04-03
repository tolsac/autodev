export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  preferred_language: "fr" | "en";
  preferred_notification_channel: "in_app" | "slack" | "email";
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  created_at: string;
}

export interface Membership {
  id: string;
  user: User;
  organization: Organization;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  ticket_prefix: string;
  organization: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  project: string;
  columns: Column[];
  created_at: string;
}

export interface Column {
  id: string;
  name: string;
  position: number;
  color: string;
  wip_limit: number | null;
  triggers: ColumnAgentTrigger[];
  ticket_count: number;
}

export interface ColumnAgentTrigger {
  id: string;
  agent_type: "challenge" | "plan" | "code" | "review" | "fix";
  trigger_mode: "auto" | "manual";
  is_active: boolean;
}

export interface Ticket {
  id: string;
  ticket_key: string;
  title: string;
  description: string;
  acceptance_criteria: string;
  column: string;
  project: string;
  priority: "none" | "low" | "medium" | "high" | "urgent";
  position: number;
  assigned_to: User | null;
  created_by: User | null;
  labels: Label[];
  challenge_status: string;
  plan_status: string;
  code_status: string;
  review_status: string;
  fix_status: string;
  estimated_complexity: string;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface SCMConnection {
  id: string;
  provider_type: "github" | "bitbucket" | "gitlab";
  external_org_name: string;
  created_at: string;
}

export interface Repository {
  id: string;
  name: string;
  full_name: string;
  provider_type: string;
  default_branch: string;
  html_url: string;
  indexing_status: "pending" | "indexing" | "indexed" | "failed";
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface RegisterResponse {
  user: User;
  access_token: string;
  refresh_token: string;
}
