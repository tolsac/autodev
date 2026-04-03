import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useOrgProjects } from "@/hooks/use-org-projects";
import ProjectCreateModal from "./ProjectCreateModal";

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "a l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`;
  return `il y a ${Math.floor(seconds / 86400)}j`;
}

export default function OrgSettingsProjects({ orgSlug }: { orgSlug: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(searchParams.get("create") === "true");
  const { data: projects, isLoading } = useOrgProjects(orgSlug, showArchived);

  // Close create modal and clean URL param
  const closeCreate = () => {
    setCreateOpen(false);
    if (searchParams.get("create")) {
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      setSearchParams(next);
    }
  };

  if (isLoading) return <div className="text-muted-foreground">Chargement...</div>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Projets ({projects?.length ?? 0})</h3>
        <button onClick={() => setCreateOpen(true)} className="h-8 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nouveau projet
        </button>
      </div>

      {(!projects || projects.length === 0) ? (
        <div className="rounded-lg border border-white/5 p-8 text-center">
          <p className="text-sm text-[#8b8b9e]">Aucun projet dans cette organisation.</p>
          <button onClick={() => setCreateOpen(true)} className="mt-3 text-sm text-primary hover:underline">
            Creer votre premier projet
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/${orgSlug}/${project.slug}/board`}
              className={`flex items-center gap-3 rounded-lg border border-white/5 px-4 py-3 transition-colors hover:bg-white/[0.02] ${project.is_archived ? "opacity-50" : ""}`}
            >
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                style={{ backgroundColor: project.color + "20", color: project.color }}
              >
                {project.icon || project.name[0]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{project.name}</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[#8b8b9e]">{project.ticket_prefix}</span>
                  {project.is_archived && <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] text-yellow-500">Archive</span>}
                </div>
                {project.description && (
                  <p className="mt-0.5 text-xs text-[#555566] truncate">{project.description}</p>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-4 text-[11px] text-[#555566]">
                <span>{project.ticket_count} tickets</span>
                <span>{project.member_count} membre{project.member_count !== 1 ? "s" : ""}</span>
                <span>{project.repo_count} repo{project.repo_count !== 1 ? "s" : ""}</span>
                <span>{timeAgo(project.updated_at)}</span>
              </div>
              <svg className="size-4 flex-shrink-0 text-[#555566]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m9 18 6-6-6-6" /></svg>
            </Link>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-[#8b8b9e] cursor-pointer">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-primary" />
        Afficher les projets archives
      </label>

      <ProjectCreateModal orgSlug={orgSlug} open={createOpen} onClose={closeCreate} />
    </div>
  );
}
