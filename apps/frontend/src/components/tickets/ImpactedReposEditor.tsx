import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Repo {
  id: string;
  name: string;
  full_name: string;
  html_url: string;
}

interface Props {
  orgSlug: string;
  projectSlug: string;
  ticketKey: string;
  impactedRepos: Repo[];
  availableRepos: Repo[];
  readOnly?: boolean;
}

export default function ImpactedReposEditor({ orgSlug, projectSlug, ticketKey, impactedRepos, availableRepos, readOnly }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (repoIds: string[]) =>
      api.patch(`/orgs/${orgSlug}/projects/${projectSlug}/tickets/${ticketKey}/impacted-repos/`, { repository_ids: repoIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", orgSlug, projectSlug, ticketKey] });
    },
  });

  const removeRepo = (repoId: string) => {
    const newIds = impactedRepos.filter((r) => r.id !== repoId).map((r) => r.id);
    mutation.mutate(newIds);
  };

  const addRepo = (repoId: string) => {
    const newIds = [...impactedRepos.map((r) => r.id), repoId];
    mutation.mutate(newIds);
    setShowAdd(false);
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Repos impactes</div>
        {!readOnly && availableRepos.length > 0 && (
          <button onClick={() => setShowAdd(!showAdd)} className="text-[10px] text-primary hover:underline">+ Ajouter</button>
        )}
      </div>

      {impactedRepos.length === 0 && (
        <div className="rounded bg-yellow-500/10 px-2 py-1.5 text-[10px] text-yellow-500">
          Aucun repo. Les agents n'auront pas acces au code.
        </div>
      )}

      <div className="space-y-1">
        {impactedRepos.map((repo) => (
          <div key={repo.id} className="flex items-center gap-1.5 text-xs">
            <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="truncate text-foreground hover:text-primary">{repo.full_name}</a>
            {!readOnly && (
              <button onClick={() => removeRepo(repo.id)} className="flex-shrink-0 text-[#8b8b9e] hover:text-destructive">
                <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add popover */}
      {showAdd && (
        <div className="mt-1 rounded-lg border border-white/10 bg-[#13131d] py-1">
          {availableRepos.map((repo) => (
            <button key={repo.id} onClick={() => addRepo(repo.id)} className="flex w-full items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-white/5">
              <svg className="size-3 flex-shrink-0 text-[#8b8b9e]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
              {repo.full_name}
            </button>
          ))}
          {availableRepos.length === 0 && <p className="px-2 py-1.5 text-xs text-[#8b8b9e]">Tous les repos sont deja impactes.</p>}
        </div>
      )}
    </div>
  );
}
