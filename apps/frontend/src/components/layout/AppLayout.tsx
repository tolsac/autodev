import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useOrgStore } from "@/stores/org-store";
import { useOrgs, useProjects } from "@/hooks/use-orgs";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  const { pathname } = useLocation();
  const setCurrentOrg = useOrgStore((s) => s.setCurrentOrg);
  const setCurrentProject = useOrgStore((s) => s.setCurrentProject);

  const parts = pathname.split("/").filter(Boolean);
  const isSettings = parts[0] === "settings";
  const orgSlug = isSettings ? null : parts[0] ?? null;
  const nonProjectPrefixes = ["settings", "notifications", "projects"];
  const secondPart = parts[1] ?? null;
  const projectSlug =
    orgSlug && secondPart && !nonProjectPrefixes.includes(secondPart)
      ? secondPart
      : null;

  // Fetch real data
  const { data: orgs } = useOrgs();
  const { data: projects } = useProjects(orgSlug);

  const prevOrgSlug = useRef(orgSlug);
  const prevProjectSlug = useRef(projectSlug);

  // Sync org from URL using real API data
  useEffect(() => {
    if (orgSlug && orgSlug !== prevOrgSlug.current && orgs) {
      const org = orgs.find((o) => o.slug === orgSlug);
      if (org) setCurrentOrg(org);
    }
    prevOrgSlug.current = orgSlug;
  }, [orgSlug, orgs, setCurrentOrg]);

  // Sync project from URL using real API data
  useEffect(() => {
    if (projectSlug !== prevProjectSlug.current) {
      if (projectSlug && projects) {
        const project = projects.find((p) => p.slug === projectSlug);
        if (project) setCurrentProject(project);
      } else {
        setCurrentProject(null);
      }
    }
    prevProjectSlug.current = projectSlug;
  }, [projectSlug, projects, setCurrentProject]);

  // Hide sidebar on org settings pages
  const isOrgSettings = orgSlug && parts[1] === "settings" && !projectSlug;

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {!isOrgSettings && <Sidebar />}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
