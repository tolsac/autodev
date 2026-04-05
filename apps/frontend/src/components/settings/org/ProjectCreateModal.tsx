import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateProject, type ProjectCreatePayload } from "@/hooks/use-org-projects";
import { useOrgRepositories } from "@/hooks/use-scm";

const COLORS = ["#7F77DD", "#378ADD", "#1D9E75", "#D85A30", "#D4537E", "#BA7517", "#E24B4A", "#5F5E5A"];

export default function ProjectCreateModal({ orgSlug, open, onClose }: {
  orgSlug: string;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const create = useCreateProject(orgSlug);
  const { data: repos } = useOrgRepositories(orgSlug);
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [prefix, setPrefix] = useState("");
  const [prefixManual, setPrefixManual] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [gitOpen, setGitOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [branch, setBranch] = useState("main");
  const [branchTemplate, setBranchTemplate] = useState("feature/{prefix}-{ticket_id}-{slug}");
  const [prTitle, setPrTitle] = useState("[{prefix}-{ticket_id}] {ticket_title}");
  const [llm, setLlm] = useState("claude-sonnet-4-20250514");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState("");

  // Auto-generate prefix from name
  useEffect(() => {
    if (prefixManual || !name) return;
    const words = name.split(/\s+/).filter(Boolean);
    const auto = words.map((w) => w[0]).join("").toUpperCase().slice(0, 4) || name.slice(0, 3).toUpperCase();
    setPrefix(auto);
  }, [name, prefixManual]);

  useEffect(() => {
    if (open) {
      setTimeout(() => nameRef.current?.focus(), 100);
      // Reset form
      setName(""); setDescription(""); setIcon(""); setColor(COLORS[0]);
      setPrefix(""); setPrefixManual(false); setSelectedRepos([]);
      setGitOpen(false); setAgentsOpen(false);
      setBranch("main"); setBranchTemplate("feature/{prefix}-{ticket_id}-{slug}");
      setPrTitle("[{prefix}-{ticket_id}] {ticket_title}");
      setLlm("claude-sonnet-4-20250514"); setInstructions(""); setError("");
    }
  }, [open]);

  const toggleRepo = (id: string) => setSelectedRepos((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    setError("");
    const payload: ProjectCreatePayload = {
      name: name.trim(),
      description: description || undefined,
      icon: icon || undefined,
      color,
      ticket_prefix: prefix || undefined,
      repository_ids: selectedRepos.length > 0 ? selectedRepos : undefined,
      default_target_branch: branch,
      branch_naming_template: branchTemplate,
      pr_title_template: prTitle,
      llm_model: llm,
      agent_global_instructions: instructions || undefined,
    };
    create.mutate(payload, {
      onSuccess: (project) => {
        onClose();
        navigate(`/${orgSlug}/${project.slug}/board`);
      },
      onError: () => setError("Impossible de creer le projet."),
    });
  };

  if (!open) return null;

  const inputClass = "h-10 w-full rounded-lg border border-foreground/10 bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
  const labelClass = "text-xs font-medium text-muted-foreground";
  const sectionTitle = "text-sm font-semibold text-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-[720px] flex-col rounded-xl border border-foreground/5 bg-surface-elevated shadow-2xl" style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-foreground/5 px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Nouveau projet</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>}

          {/* General */}
          <section className="space-y-4">
            <h3 className={sectionTitle}>Informations generales</h3>
            <div className="space-y-1.5">
              <label className={labelClass}>Nom du projet *</label>
              <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Mon Projet" maxLength={255} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Decrivez le projet en quelques phrases..." rows={3} className={`${inputClass} h-auto py-2`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelClass}>Couleur</label>
                <div className="flex gap-1.5">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} className={`h-7 w-7 rounded-lg transition-all ${color === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#13131d]" : "hover:scale-110"}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Icone (emoji)</label>
                <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🚀" maxLength={4} className={`${inputClass} w-20`} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Prefixe des tickets</label>
              <input value={prefix} onChange={(e) => { setPrefixManual(true); setPrefix(e.target.value.toUpperCase()); }} maxLength={10} className={`${inputClass} w-24`} />
              <p className="text-[10px] text-muted-foreground/60">Les tickets seront numerotes {prefix || "XX"}-1, {prefix || "XX"}-2...</p>
            </div>
          </section>

          <div className="h-px bg-foreground/5" />

          {/* Repositories */}
          <section className="space-y-3">
            <h3 className={sectionTitle}>Repositories</h3>
            <p className="text-xs text-muted-foreground">Liez les repos sur lesquels les agents AI travailleront.</p>
            {(!repos || repos.length === 0) ? (
              <div className="rounded-lg border border-foreground/5 p-4 text-center text-xs text-muted-foreground">
                Aucun repository disponible. Importez des repos depuis l'onglet Connexions Git.
              </div>
            ) : (
              <div className="space-y-1 rounded-lg border border-foreground/5 p-2">
                {repos.map((repo) => (
                  <label key={repo.id} className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-foreground/[0.02]">
                    <input type="checkbox" checked={selectedRepos.includes(repo.id)} onChange={() => toggleRepo(repo.id)} className="accent-primary" />
                    <svg className="size-4 flex-shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                    <span className="flex-1 text-sm text-foreground truncate">{repo.full_name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      repo.indexing_status === "indexed" ? "bg-green-500/10 text-green-500" :
                      repo.indexing_status === "failed" ? "bg-red-500/10 text-red-500" :
                      "bg-yellow-500/10 text-yellow-500"
                    }`}>{repo.indexing_status}</span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <div className="h-px bg-foreground/5" />

          {/* Git conventions (collapsible) */}
          <section>
            <button onClick={() => setGitOpen(!gitOpen)} className="flex w-full items-center gap-2 text-sm font-semibold text-foreground hover:text-primary">
              <svg className={`size-4 transition-transform ${gitOpen ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
              Conventions Git
              <span className="text-xs font-normal text-muted-foreground/60">(optionnel)</span>
            </button>
            {gitOpen && (
              <div className="mt-3 space-y-3 pl-6">
                <div className="space-y-1.5">
                  <label className={labelClass}>Branche cible par defaut</label>
                  <input value={branch} onChange={(e) => setBranch(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Template de branche</label>
                  <input value={branchTemplate} onChange={(e) => setBranchTemplate(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Template titre PR</label>
                  <input value={prTitle} onChange={(e) => setPrTitle(e.target.value)} className={inputClass} />
                </div>
              </div>
            )}
          </section>

          <div className="h-px bg-foreground/5" />

          {/* Agents IA (collapsible) */}
          <section>
            <button onClick={() => setAgentsOpen(!agentsOpen)} className="flex w-full items-center gap-2 text-sm font-semibold text-foreground hover:text-primary">
              <svg className={`size-4 transition-transform ${agentsOpen ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
              Agents IA
              <span className="text-xs font-normal text-muted-foreground/60">(optionnel)</span>
            </button>
            {agentsOpen && (
              <div className="mt-3 space-y-3 pl-6">
                <div className="space-y-1.5">
                  <label className={labelClass}>Modele LLM</label>
                  <select value={llm} onChange={(e) => setLlm(e.target.value)} className={inputClass}>
                    <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                    <option value="claude-opus-4-20250514">Claude Opus 4</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Instructions globales</label>
                  <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} placeholder="Decrivez l'architecture, les conventions, le style de code..." className={`${inputClass} h-auto py-2`} />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-foreground/5 px-6 py-3">
          <button onClick={onClose} className="h-9 rounded-lg border border-foreground/10 px-4 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
          <button onClick={handleSubmit} disabled={create.isPending || !name.trim()} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {create.isPending ? "Creation..." : "Creer le projet"}
          </button>
        </div>
      </div>
    </div>
  );
}
