import { useState, useMemo } from "react";
import { useAvailableRepos, useImportRepositories, type SCMConnectionItem } from "@/hooks/use-scm";

export default function RepoImportModal({ orgSlug, connection, open, onClose }: {
  orgSlug: string;
  connection: SCMConnectionItem;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useAvailableRepos(orgSlug, open ? connection.id : null);
  const importRepos = useImportRepositories(orgSlug);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!data?.available) return [];
    if (!search.trim()) return data.available;
    const q = search.toLowerCase();
    return data.available.filter((r) => r.full_name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q));
  }, [data, search]);

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.external_id)));
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleImport = () => {
    importRepos.mutate(
      { scm_connection_id: connection.id, external_ids: Array.from(selected) },
      { onSuccess: () => { setSelected(new Set()); onClose(); } },
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-xl flex-col rounded-xl border border-foreground/5 bg-surface-elevated shadow-2xl" style={{ maxHeight: "80vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-foreground/5 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Importer des repositories</h2>
            <p className="text-xs text-muted-foreground">Source : GitHub — {connection.external_org_name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>

        {/* Search + select all */}
        <div className="border-b border-foreground/5 px-6 py-3 space-y-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un repo..." className="h-8 w-full rounded-lg border border-foreground/10 bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
          </div>
          {data && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="accent-primary" />
                Tout selectionner ({filtered.length} repos)
              </label>
              <span>{data.already_imported} deja importes</span>
            </div>
          )}
        </div>

        {/* Repo list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Chargement des repos depuis GitHub...</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Aucun repo disponible</div>
          ) : (
            filtered.map((repo) => (
              <label key={repo.external_id} className="flex items-start gap-3 border-b border-foreground/[0.03] px-6 py-3 cursor-pointer hover:bg-foreground/[0.02]">
                <input type="checkbox" checked={selected.has(repo.external_id)} onChange={() => toggle(repo.external_id)} className="mt-1 accent-primary" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{repo.full_name}</span>
                    {repo.language && <span className="rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">{repo.language}</span>}
                    <span className="rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">{repo.private ? "prive" : "public"}</span>
                  </div>
                  {repo.description && <p className="mt-0.5 text-xs text-muted-foreground/60 truncate">{repo.description}</p>}
                </div>
              </label>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-foreground/5 px-6 py-3">
          <button onClick={onClose} className="h-9 rounded-lg border border-foreground/10 px-4 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
          <button onClick={handleImport} disabled={selected.size === 0 || importRepos.isPending} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {importRepos.isPending ? "Import..." : `Importer ${selected.size} repo${selected.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
