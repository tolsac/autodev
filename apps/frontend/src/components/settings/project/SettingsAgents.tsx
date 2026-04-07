import { useState, useEffect } from "react";
import type { ProjectSettings } from "@/hooks/use-project-settings";
import { useUpdateProjectSettings } from "@/hooks/use-project-settings";

const AGENTS = [
  { key: "agent_challenge_instructions", name: "Challenge Agent", hasThreshold: true },
  { key: "agent_plan_instructions", name: "Plan Agent" },
  { key: "agent_code_instructions", name: "Code Agent" },
  { key: "agent_review_instructions", name: "Review Agent" },
  { key: "agent_fix_instructions", name: "Fix Agent", hasFix: true },
] as const;

const SEVERITIES = ["critical", "major", "minor", "suggestion"];

export default function SettingsAgents({ settings, orgSlug, projectSlug }: { settings: ProjectSettings; orgSlug: string; projectSlug: string }) {
  const [llm, setLlm] = useState(settings.llm_model);
  const [globalInst, setGlobalInst] = useState(settings.agent_global_instructions);
  const [agentInst, setAgentInst] = useState<Record<string, string>>({});
  const [threshold, setThreshold] = useState(settings.challenge_auto_approve_threshold);
  const [sevFilter, setSevFilter] = useState<string[]>(settings.fix_severity_filter);
  const [maxIter, setMaxIter] = useState(settings.fix_max_iterations);
  const [expanded, setExpanded] = useState<string | null>("agent_challenge_instructions");
  const update = useUpdateProjectSettings(orgSlug, projectSlug);

  useEffect(() => {
    setLlm(settings.llm_model);
    setGlobalInst(settings.agent_global_instructions);
    setThreshold(settings.challenge_auto_approve_threshold);
    setSevFilter(settings.fix_severity_filter);
    setMaxIter(settings.fix_max_iterations);
    const inst: Record<string, string> = {};
    for (const a of AGENTS) inst[a.key] = (settings as any)[a.key] ?? "";
    setAgentInst(inst);
  }, [settings]);

  const toggleSev = (s: string) => setSevFilter((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const handleSave = () => {
    const data: Record<string, unknown> = {
      llm_model: llm,
      agent_global_instructions: globalInst,
      challenge_auto_approve_threshold: threshold,
      fix_severity_filter: sevFilter,
      fix_max_iterations: maxIter,
    };
    for (const a of AGENTS) data[a.key] = agentInst[a.key] ?? "";
    update.mutate(data as any);
  };

  const inputClass = "h-10 w-full rounded-lg border border-foreground/10 bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
  const textareaClass = "w-full resize-y rounded-lg border border-foreground/10 bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Modele LLM</label>
        <select value={llm} onChange={(e) => setLlm(e.target.value)} className={inputClass}>
          <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
          <option value="claude-opus-4-20250514">Claude Opus 4</option>
        </select>
        <p className="text-[11px] text-muted-foreground/60">Le modele utilise par tous les agents de ce projet.</p>
      </div>

      <div className="h-px bg-foreground/5" />

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Instructions globales</label>
        <p className="text-[11px] text-muted-foreground/60">Partagees avec tous les agents comme contexte du projet.</p>
        <textarea value={globalInst} onChange={(e) => setGlobalInst(e.target.value)} rows={6} placeholder="Decrivez l'architecture du projet, les conventions de code..." className={textareaClass} />
      </div>

      <div className="h-px bg-foreground/5" />

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Instructions par agent</h3>
        {AGENTS.map((agent) => (
          <div key={agent.key} className="rounded-lg border border-foreground/5">
            <button
              onClick={() => setExpanded(expanded === agent.key ? null : agent.key)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-foreground/[0.02]"
            >
              <span className="font-medium">{agent.name}</span>
              <svg className={`size-4 text-muted-foreground transition-transform ${expanded === agent.key ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
            </button>
            {expanded === agent.key && (
              <div className="space-y-3 border-t border-foreground/5 px-4 py-3">
                <textarea
                  value={agentInst[agent.key] ?? ""}
                  onChange={(e) => setAgentInst({ ...agentInst, [agent.key]: e.target.value })}
                  rows={3}
                  placeholder={`Instructions specifiques pour ${agent.name}...`}
                  className={textareaClass}
                />
                {"hasThreshold" in agent && agent.hasThreshold && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Seuil d'auto-approbation</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min={0} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="flex-1 accent-primary" />
                      <input type="number" min={0} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-16 rounded-lg border border-foreground/10 bg-surface px-2 py-1 text-center text-sm text-foreground" />
                      <span className="text-xs text-muted-foreground">/100</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60">Si le score &gt;= seuil, le ticket est approuve automatiquement.</p>
                  </div>
                )}
                {"hasFix" in agent && agent.hasFix && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Severites a fixer automatiquement</label>
                      <div className="flex gap-3">
                        {SEVERITIES.map((s) => (
                          <label key={s} className="flex items-center gap-1.5 text-sm text-foreground">
                            <input type="checkbox" checked={sevFilter.includes(s)} onChange={() => toggleSev(s)} className="accent-primary" />
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Iterations max review → fix</label>
                      <input type="number" min={1} max={10} value={maxIter} onChange={(e) => setMaxIter(Number(e.target.value))} className="w-20 rounded-lg border border-foreground/10 bg-surface px-2 py-1 text-center text-sm text-foreground" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={update.isPending} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {update.isPending ? "Sauvegarde..." : "Sauvegarder"}
        </button>
      </div>
    </div>
  );
}
