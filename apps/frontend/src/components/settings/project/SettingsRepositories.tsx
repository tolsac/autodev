import { useState, useEffect } from "react";
import type { ProjectSettings } from "@/hooks/use-project-settings";
import { useUpdateProjectSettings } from "@/hooks/use-project-settings";

export default function SettingsRepositories({ settings, orgSlug, projectSlug }: { settings: ProjectSettings; orgSlug: string; projectSlug: string }) {
  const [defaultBranch, setDefaultBranch] = useState(settings.default_target_branch);
  const [branchTemplate, setBranchTemplate] = useState(settings.branch_naming_template);
  const [prTitle, setPrTitle] = useState(settings.pr_title_template);
  const [prBody, setPrBody] = useState(settings.pr_body_template);
  const update = useUpdateProjectSettings(orgSlug, projectSlug);

  useEffect(() => { setDefaultBranch(settings.default_target_branch); setBranchTemplate(settings.branch_naming_template); setPrTitle(settings.pr_title_template); setPrBody(settings.pr_body_template); }, [settings]);

  const preview = (template: string) =>
    template.replace("{prefix}", settings.ticket_prefix).replace("{ticket_id}", "42").replace("{slug}", "auth-oauth-github").replace("{ticket_title}", "Auth OAuth GitHub").replace("{ticket_description}", "Implement OAuth...").replace("{plan_summary}", "1. Backend endpoint...");

  const inputClass = "h-10 w-full rounded-lg border border-white/10 bg-[#0c0c14] px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Repositories connectes</h3>
        <p className="text-xs text-[#8b8b9e]">Gerez les repos Git lies a ce projet depuis l'onglet repositories de l'organisation.</p>
      </div>

      <div className="h-px bg-white/5" />

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Conventions Git</h3>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#8b8b9e]">Branche cible par defaut</label>
          <input value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#8b8b9e]">Template de branche</label>
          <input value={branchTemplate} onChange={(e) => setBranchTemplate(e.target.value)} className={inputClass} />
          <p className="text-[11px] text-[#555566]">Preview : {preview(branchTemplate)}</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#8b8b9e]">Template titre PR</label>
          <input value={prTitle} onChange={(e) => setPrTitle(e.target.value)} className={inputClass} />
          <p className="text-[11px] text-[#555566]">Preview : {preview(prTitle)}</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#8b8b9e]">Template body PR (Markdown)</label>
          <textarea value={prBody} onChange={(e) => setPrBody(e.target.value)} rows={6} className={`${inputClass} h-auto py-2`} />
          <p className="text-[11px] text-[#555566]">Variables : {"{ticket_id}"}, {"{ticket_key}"}, {"{ticket_title}"}, {"{ticket_description}"}, {"{plan_summary}"}</p>
        </div>
        <div className="flex justify-end">
          <button onClick={() => update.mutate({ default_target_branch: defaultBranch, branch_naming_template: branchTemplate, pr_title_template: prTitle, pr_body_template: prBody })} disabled={update.isPending} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {update.isPending ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}
