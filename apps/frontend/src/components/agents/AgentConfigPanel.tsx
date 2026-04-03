import { useState, useEffect } from "react";
import { useUpdateAgentConfig, AGENT_INFO, type AgentConfig } from "@/hooks/use-agent-configs";
import { useProjectColumns } from "@/hooks/use-project-data";
import LLMModelSelector from "./LLMModelSelector";

const SEVERITIES = ["critical", "major", "minor", "suggestion"];

export default function AgentConfigPanel({ config, orgSlug, projectSlug }: {
  config: AgentConfig;
  orgSlug: string;
  projectSlug: string;
}) {
  const info = AGENT_INFO[config.agent_type];
  const update = useUpdateAgentConfig(orgSlug, projectSlug);
  const { data: columns } = useProjectColumns(orgSlug, projectSlug);

  const [llm, setLlm] = useState(config.llm_model);
  const [temp, setTemp] = useState(config.temperature);
  const [maxTokens, setMaxTokens] = useState(config.max_tokens ?? "");
  const [prompt, setPrompt] = useState(config.system_prompt);
  const [triggerCreated, setTriggerCreated] = useState(config.trigger_on_ticket_created);
  const [triggerMoved, setTriggerMoved] = useState(config.trigger_on_ticket_moved);
  const [moveSource, setMoveSource] = useState(config.trigger_move_source_column ?? "");
  const [moveTarget, setMoveTarget] = useState(config.trigger_move_target_column ?? "");
  const [triggerModified, setTriggerModified] = useState(config.trigger_on_ticket_modified);
  const [triggerPR, setTriggerPR] = useState(config.trigger_on_pr_created);
  const [triggerMerged, setTriggerMerged] = useState(config.trigger_on_pr_merged);
  const [reqChallenge, setReqChallenge] = useState(config.requires_challenge_approved);
  const [reqPlan, setReqPlan] = useState(config.requires_plan_approved);
  const [reqPR, setReqPR] = useState(config.requires_pr_created);
  const [reqReview, setReqReview] = useState(config.requires_review_completed);
  const [postCol, setPostCol] = useState(config.post_move_to_column ?? "");
  const [notifyAssignee, setNotifyAssignee] = useState(config.post_notify_assignee);
  const [notifyCreator, setNotifyCreator] = useState(config.post_notify_creator);
  const [threshold, setThreshold] = useState(config.challenge_auto_approve_threshold ?? 85);
  const [sevFilter, setSevFilter] = useState(config.fix_severity_filter);
  const [maxIter, setMaxIter] = useState(config.fix_max_iterations);

  useEffect(() => {
    setLlm(config.llm_model); setTemp(config.temperature); setMaxTokens(config.max_tokens ?? "");
    setPrompt(config.system_prompt);
    setTriggerCreated(config.trigger_on_ticket_created); setTriggerMoved(config.trigger_on_ticket_moved);
    setMoveSource(config.trigger_move_source_column ?? ""); setMoveTarget(config.trigger_move_target_column ?? "");
    setTriggerModified(config.trigger_on_ticket_modified); setTriggerPR(config.trigger_on_pr_created); setTriggerMerged(config.trigger_on_pr_merged);
    setReqChallenge(config.requires_challenge_approved); setReqPlan(config.requires_plan_approved);
    setReqPR(config.requires_pr_created); setReqReview(config.requires_review_completed);
    setPostCol(config.post_move_to_column ?? ""); setNotifyAssignee(config.post_notify_assignee); setNotifyCreator(config.post_notify_creator);
    setThreshold(config.challenge_auto_approve_threshold ?? 85); setSevFilter(config.fix_severity_filter); setMaxIter(config.fix_max_iterations);
  }, [config]);

  const handleToggle = () => {
    update.mutate({ agentType: config.agent_type, data: { is_enabled: !config.is_enabled } });
  };

  const handleSave = () => {
    update.mutate({
      agentType: config.agent_type,
      data: {
        llm_model: llm, temperature: temp, max_tokens: maxTokens ? Number(maxTokens) : null,
        system_prompt: prompt,
        trigger_on_ticket_created: triggerCreated, trigger_on_ticket_moved: triggerMoved,
        trigger_move_source_column: moveSource || null, trigger_move_target_column: moveTarget || null,
        trigger_on_ticket_modified: triggerModified, trigger_on_pr_created: triggerPR, trigger_on_pr_merged: triggerMerged,
        requires_challenge_approved: reqChallenge, requires_plan_approved: reqPlan,
        requires_pr_created: reqPR, requires_review_completed: reqReview,
        post_move_to_column: postCol || null, post_notify_assignee: notifyAssignee, post_notify_creator: notifyCreator,
        challenge_auto_approve_threshold: config.agent_type === "challenge" ? threshold : undefined,
        fix_severity_filter: config.agent_type === "fix" ? sevFilter : undefined,
        fix_max_iterations: config.agent_type === "fix" ? maxIter : undefined,
      },
    });
  };

  const labelClass = "text-xs font-medium text-[#8b8b9e]";
  const sectionClass = "text-sm font-semibold text-foreground";
  const selectClass = "h-9 w-full rounded-lg border border-white/10 bg-[#0c0c14] px-3 text-sm text-foreground focus:border-primary focus:outline-none";
  const disabled = !config.is_enabled;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header + toggle */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{info.name} Agent</h3>
          <p className="mt-0.5 text-sm text-[#8b8b9e]">{info.description}</p>
        </div>
        <button onClick={handleToggle} className={`relative h-6 w-11 rounded-full transition-colors ${config.is_enabled ? "bg-primary" : "bg-white/10"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${config.is_enabled ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>

      <div className={disabled ? "opacity-40 pointer-events-none" : ""}>
        {/* LLM */}
        <section className="space-y-3">
          <h4 className={sectionClass}>Modele LLM</h4>
          <LLMModelSelector value={llm} onChange={setLlm} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Temperature</label>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={2} step={0.1} value={temp} onChange={(e) => setTemp(Number(e.target.value))} className="flex-1 accent-primary" />
                <span className="w-8 text-center text-sm text-foreground">{temp}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Max tokens</label>
              <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} placeholder="Defaut" className="h-9 w-full rounded-lg border border-white/10 bg-[#0c0c14] px-3 text-sm text-foreground" />
            </div>
          </div>
        </section>

        <div className="h-px bg-white/5 my-5" />

        {/* Prompt */}
        <section className="space-y-3">
          <h4 className={sectionClass}>Pre-prompt</h4>
          <p className="text-xs text-[#8b8b9e]">Instructions envoyees au LLM avant chaque execution.</p>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} placeholder="Decrivez le contexte, les conventions..." className="w-full resize-y rounded-lg border border-white/10 bg-[#0c0c14] px-3 py-2 text-sm text-foreground placeholder:text-[#8b8b9e] focus:border-primary focus:outline-none" />
        </section>

        <div className="h-px bg-white/5 my-5" />

        {/* Triggers */}
        <section className="space-y-3">
          <h4 className={sectionClass}>Declenchement automatique</h4>
          <div className="space-y-2">
            <Check label="Un ticket est cree" checked={triggerCreated} onChange={setTriggerCreated} />
            <Check label="Un ticket est deplace" checked={triggerMoved} onChange={setTriggerMoved} />
            {triggerMoved && (
              <div className="ml-6 grid grid-cols-2 gap-2">
                <select value={moveSource} onChange={(e) => setMoveSource(e.target.value)} className={selectClass}>
                  <option value="">N'importe quelle colonne</option>
                  {columns?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} className={selectClass}>
                  <option value="">N'importe quelle colonne</option>
                  {columns?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <Check label="Un ticket est modifie" checked={triggerModified} onChange={setTriggerModified} />
            <Check label="Une PR est creee" checked={triggerPR} onChange={setTriggerPR} />
            <Check label="Une PR est mergee" checked={triggerMerged} onChange={setTriggerMerged} />
          </div>
        </section>

        <div className="h-px bg-white/5 my-5" />

        {/* Prerequisites */}
        <section className="space-y-3">
          <h4 className={sectionClass}>Pre-requis</h4>
          <div className="space-y-2">
            {config.agent_type !== "challenge" && <Check label="Challenge approuve" checked={reqChallenge} onChange={setReqChallenge} />}
            {config.agent_type !== "challenge" && config.agent_type !== "plan" && <Check label="Plan approuve" checked={reqPlan} onChange={setReqPlan} />}
            <Check label="PR creee (Code Agent termine)" checked={reqPR} onChange={setReqPR} />
            <Check label="Review terminee" checked={reqReview} onChange={setReqReview} />
          </div>
        </section>

        <div className="h-px bg-white/5 my-5" />

        {/* Post-execution */}
        <section className="space-y-3">
          <h4 className={sectionClass}>Apres execution</h4>
          <div className="space-y-2">
            <div className="space-y-1.5">
              <label className={labelClass}>Deplacer le ticket vers</label>
              <select value={postCol} onChange={(e) => setPostCol(e.target.value)} className={selectClass}>
                <option value="">Aucun deplacement</option>
                {columns?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Check label="Notifier l'assigne du ticket" checked={notifyAssignee} onChange={setNotifyAssignee} />
            <Check label="Notifier le createur du ticket" checked={notifyCreator} onChange={setNotifyCreator} />
          </div>
        </section>

        {/* Agent-specific */}
        {config.agent_type === "challenge" && (
          <>
            <div className="h-px bg-white/5 my-5" />
            <section className="space-y-3">
              <h4 className={sectionClass}>Parametres Challenge</h4>
              <div className="space-y-1.5">
                <label className={labelClass}>Seuil d'auto-approbation</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="flex-1 accent-primary" />
                  <span className="w-10 text-center text-sm text-foreground">{threshold}</span>
                  <span className="text-xs text-[#8b8b9e]">/100</span>
                </div>
                <p className="text-[10px] text-[#555566]">Score &gt;= seuil → ticket approuve automatiquement.</p>
              </div>
            </section>
          </>
        )}

        {config.agent_type === "fix" && (
          <>
            <div className="h-px bg-white/5 my-5" />
            <section className="space-y-3">
              <h4 className={sectionClass}>Parametres Fix</h4>
              <div className="space-y-1.5">
                <label className={labelClass}>Severites a fixer</label>
                <div className="flex gap-3">
                  {SEVERITIES.map((s) => (
                    <Check key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} checked={sevFilter.includes(s)} onChange={(checked) => setSevFilter(checked ? [...sevFilter, s] : sevFilter.filter((x) => x !== s))} />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Iterations max review → fix</label>
                <input type="number" min={1} max={10} value={maxIter} onChange={(e) => setMaxIter(Number(e.target.value))} className="w-20 rounded-lg border border-white/10 bg-[#0c0c14] px-2 py-1 text-center text-sm text-foreground" />
              </div>
            </section>
          </>
        )}

        <div className="mt-6 flex justify-end">
          <button onClick={handleSave} disabled={update.isPending} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {update.isPending ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-primary" />
      {label}
    </label>
  );
}
