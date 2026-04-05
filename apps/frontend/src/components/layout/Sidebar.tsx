import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOrgStore } from "@/stores/org-store";
import { useCurrentRoute } from "@/hooks/use-current-route";
import { useProjects } from "@/hooks/use-orgs";

export default function Sidebar() {
  const route = useCurrentRoute();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const currentProject = useOrgStore((s) => s.currentProject);
  const orgSlug = currentOrg?.slug;
  const projectSlug = route.projectSlug ?? currentProject?.slug ?? null;

  return (
    <aside className="flex w-[220px] flex-shrink-0 flex-col bg-surface text-sm">
      {/* Org + Project header */}
      <div className="border-b border-foreground/5 px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-xs font-bold text-primary">
            {currentOrg?.name?.[0] ?? "A"}
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold text-foreground">
              {currentOrg?.name ?? "Organisation"}
            </div>
            {currentProject && (
              <div className="truncate text-xs text-muted-foreground">
                {currentProject.name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Project Selector — always visible above project nav */}
      {orgSlug && (
        <div className="px-2 py-2">
          <ProjectSelector orgSlug={orgSlug} />
        </div>
      )}

      {/* Project navigation */}
      <nav className="flex-1 space-y-0.5 px-2">
        {projectSlug && orgSlug && (
          <>
            <div className="px-3 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Projet
            </div>
            <NavItem
              to={`/${orgSlug}/${projectSlug}/board`}
              icon={<BoardIcon />}
              label="Sprint Plan"
              active={route.section === "board"}
            />
            <NavItem
              to={`/${orgSlug}/${projectSlug}/tickets`}
              icon={<TicketsIcon />}
              label="Tickets"
              active={route.section === "tickets" || route.section === "ticket-detail"}
            />
            <NavItem
              to={`/${orgSlug}/${projectSlug}/agents`}
              icon={<AgentsIcon />}
              label="Agents"
              active={route.section === "agents" as any}
            />
            <NavItem
              to={`/${orgSlug}/${projectSlug}/activity`}
              icon={<TasksIcon />}
              label="My Tasks"
              active={route.section === "activity"}
            />
            <NavItem
              to={`/${orgSlug}/${projectSlug}/activity`}
              icon={<AnalyticsIcon />}
              label="Analytics"
              active={false}
            />
            <NavItem
              to={`/${orgSlug}/${projectSlug}/settings`}
              icon={<SettingsIcon />}
              label="Settings"
              active={route.section === "project-settings"}
            />
          </>
        )}
      </nav>

      {/* Bottom section — Organisation */}
      <div className="border-t border-foreground/5 px-2 py-3 space-y-0.5">
        {orgSlug && (
          <>
            <div className="px-3 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Organisation
            </div>
            <NavItem
              to={`/${orgSlug}/settings`}
              icon={<SettingsIcon />}
              label="Settings"
              active={route.section === "org-settings"}
            />
            <NavItem
              to="#"
              icon={<SupportIcon />}
              label="Support"
              active={false}
            />
          </>
        )}
      </div>
    </aside>
  );
}

/* ── NavItem ── */

function NavItem({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors ${
        active
          ? "bg-primary/15 font-medium text-primary"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

/* ── ProjectSelector ── */

function ProjectSelector({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false);
  const currentProject = useOrgStore((s) => s.currentProject);
  const setCurrentProject = useOrgStore((s) => s.setCurrentProject);
  const navigate = useNavigate();
  const { data: projects } = useProjects(orgSlug);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-foreground/5 px-3 py-2.5 text-left transition-colors hover:bg-foreground/5"
      >
        <span
          className="h-3 w-3 rounded-sm flex-shrink-0"
          style={{ backgroundColor: currentProject?.color ?? "#6B7280" }}
        />
        <span className="flex-1 truncate text-sm text-foreground">
          {currentProject?.name ?? "Choisir un projet"}
        </span>
        <svg className="size-3.5 flex-shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" /></svg>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-foreground/5 bg-surface-elevated shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-foreground/5 px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Choisir un projet</h2>
              <button onClick={() => setOpen(false)} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>

            {/* Project list */}
            <div className="max-h-[50vh] overflow-y-auto py-2">
              {(!projects || projects.length === 0) ? (
                <p className="px-5 py-4 text-center text-sm text-muted-foreground">Aucun projet. Creez-en un pour commencer.</p>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setCurrentProject(project);
                      navigate(`/${orgSlug}/${project.slug}/board`);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 px-5 py-2.5 transition-colors hover:bg-foreground/5 ${
                      currentProject?.id === project.id ? "bg-foreground/[0.03]" : ""
                    }`}
                  >
                    <span className="h-3 w-3 rounded-sm flex-shrink-0" style={{ backgroundColor: project.color }} />
                    <span className="flex-1 truncate text-left text-sm text-foreground">{project.name}</span>
                    <span className="text-[10px] text-muted-foreground/60">{project.ticket_prefix}</span>
                    {currentProject?.id === project.id && (
                      <svg className="size-4 flex-shrink-0 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-foreground/5 px-5 py-3">
              <Link
                to={`/${orgSlug}/settings/projects?create=true`}
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-foreground/10 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                <PlusIcon />
                Nouveau projet
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Icons ── */

const ic = "size-4 flex-shrink-0";

function BoardIcon() {
  return (
    <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M15 3v18" />
    </svg>
  );
}

function TicketsIcon() {
  return (
    <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 14h6" /><path d="M9 18h6" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function AgentsIcon() {
  return (
    <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

