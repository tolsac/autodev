import { useLocation } from "react-router-dom";

export type Section =
  | "dashboard"
  | "board"
  | "tickets"
  | "ticket-detail"
  | "activity"
  | "project-settings"
  | "org-settings"
  | "members"
  | "scm"
  | "billing"
  | "notifications"
  | "profile"
  | "new-project"
  | null;

export interface CurrentRoute {
  orgSlug: string | null;
  projectSlug: string | null;
  section: Section;
  ticketKey: string | null;
}

export function useCurrentRoute(): CurrentRoute {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);

  // /settings/profile
  if (parts[0] === "settings" && parts[1] === "profile") {
    return { orgSlug: null, projectSlug: null, section: "profile", ticketKey: null };
  }

  const orgSlug = parts[0] ?? null;
  if (!orgSlug) {
    return { orgSlug: null, projectSlug: null, section: null, ticketKey: null };
  }

  // /:org/notifications
  if (parts[1] === "notifications") {
    return { orgSlug, projectSlug: null, section: "notifications", ticketKey: null };
  }

  // /:org/settings/*
  if (parts[1] === "settings") {
    return { orgSlug, projectSlug: null, section: "org-settings", ticketKey: null };
  }

  // /:org/projects/new
  if (parts[1] === "projects" && parts[2] === "new") {
    return { orgSlug, projectSlug: null, section: "new-project", ticketKey: null };
  }

  // /:org/:project/*
  const projectSlug = parts[1] ?? null;
  if (!projectSlug) {
    return { orgSlug, projectSlug: null, section: "dashboard", ticketKey: null };
  }

  const sub = parts[2] ?? null;
  if (sub === "board") return { orgSlug, projectSlug, section: "board", ticketKey: null };
  if (sub === "tickets" && parts[3]) return { orgSlug, projectSlug, section: "ticket-detail", ticketKey: parts[3] };
  if (sub === "tickets") return { orgSlug, projectSlug, section: "tickets", ticketKey: null };
  if (sub === "agents") return { orgSlug, projectSlug, section: "agents" as any, ticketKey: null };
  if (sub === "activity") return { orgSlug, projectSlug, section: "activity", ticketKey: null };
  if (sub === "settings") return { orgSlug, projectSlug, section: "project-settings", ticketKey: null };

  return { orgSlug, projectSlug: null, section: "dashboard", ticketKey: null };
}
