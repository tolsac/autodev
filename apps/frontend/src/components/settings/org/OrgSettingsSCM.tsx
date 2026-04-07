import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSCMConnections, useOrgRepositories, useDisconnectSCM } from "@/hooks/use-scm";
import SCMConnectModal from "./SCMConnectModal";
import RepoImportModal from "./RepoImportModal";

function timeAgo(date: string | null): string {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "a l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`;
  return `il y a ${Math.floor(seconds / 86400)}j`;
}

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  pending: { label: "En attente", class: "bg-yellow-500/10 text-yellow-500" },
  indexing: { label: "Indexation...", class: "bg-blue-500/10 text-blue-500" },
  indexed: { label: "Indexe", class: "bg-green-500/10 text-green-500" },
  failed: { label: "Echec", class: "bg-red-500/10 text-red-500" },
};

export default function OrgSettingsSCM({ orgSlug }: { orgSlug: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [connectOpen, setConnectOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data: connections, isLoading: connLoading } = useSCMConnections(orgSlug);
  const { data: repos, isLoading: reposLoading } = useOrgRepositories(orgSlug);
  const disconnect = useDisconnectSCM(orgSlug);

  // Handle query params from GitHub callback
  useEffect(() => {
    if (searchParams.get("connected") === "github") {
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const githubConnection = connections?.find((c) => c.provider_type === "github") ?? null;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Connections */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Forges Git connectees</h3>
        <button onClick={() => setConnectOpen(true)} className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90">+ Connecter</button>
      </div>

      {connLoading ? (
        <div className="text-sm text-muted-foreground">Chargement...</div>
      ) : !connections || connections.length === 0 ? (
        <div className="rounded-lg border border-foreground/5 p-8 text-center">
          <svg className="mx-auto size-8 text-muted-foreground/60" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
          <p className="mt-3 text-sm text-muted-foreground">Aucune forge connectee</p>
          <button onClick={() => setConnectOpen(true)} className="mt-3 h-8 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90">Connecter GitHub</button>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((conn) => (
            <div key={conn.id} className="flex items-center justify-between rounded-lg border border-foreground/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <svg className="size-5 text-foreground" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                <div>
                  <span className="text-sm font-medium text-foreground">{conn.external_org_name || "GitHub"}</span>
                  <span className="ml-2 rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-500">Connecte</span>
                </div>
              </div>
              <button onClick={() => disconnect.mutate(conn.id)} className="h-7 rounded-md border border-foreground/10 px-2.5 text-xs text-muted-foreground hover:border-destructive/30 hover:text-destructive">Deconnecter</button>
            </div>
          ))}
        </div>
      )}

      {/* Repositories */}
      {connections && connections.length > 0 && (
        <>
          <div className="h-px bg-foreground/5" />
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Repositories ({repos?.length ?? 0})</h3>
            <button onClick={() => setImportOpen(true)} className="h-8 rounded-lg border border-foreground/10 px-3 text-xs text-muted-foreground hover:text-foreground">+ Importer</button>
          </div>

          {reposLoading ? (
            <div className="text-sm text-muted-foreground">Chargement...</div>
          ) : !repos || repos.length === 0 ? (
            <div className="rounded-lg border border-foreground/5 p-6 text-center text-sm text-muted-foreground">
              Aucun repo importe. Cliquez sur "+ Importer" pour selectionner des repos.
            </div>
          ) : (
            <div className="space-y-1">
              {repos.map((repo) => {
                const badge = STATUS_BADGE[repo.indexing_status] ?? STATUS_BADGE.pending;
                return (
                  <div key={repo.id} className="flex items-center gap-3 rounded-lg border border-foreground/5 px-4 py-2.5">
                    <svg className="size-4 flex-shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                    <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm text-foreground hover:text-primary">{repo.full_name}</a>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.class}`}>
                      {badge.label}
                      {repo.indexing_status === "indexed" && repo.last_indexed_at && ` ${timeAgo(repo.last_indexed_at)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <SCMConnectModal orgSlug={orgSlug} open={connectOpen} onClose={() => setConnectOpen(false)} />
      {githubConnection && (
        <RepoImportModal orgSlug={orgSlug} connection={githubConnection} open={importOpen} onClose={() => setImportOpen(false)} />
      )}
    </div>
  );
}
