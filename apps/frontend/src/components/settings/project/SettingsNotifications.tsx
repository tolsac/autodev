import { useState, useEffect } from "react";
import type { ProjectSettings } from "@/hooks/use-project-settings";
import { useUpdateProjectSettings } from "@/hooks/use-project-settings";

const TOGGLES = [
  { key: "notify_agent_questions", label: "Questions des agents AI", desc: "Notifier quand un agent pose une question sur un ticket" },
  { key: "notify_plan_generated", label: "Plans d'implementation generes", desc: "Notifier quand un plan est pret pour validation" },
  { key: "notify_pr_created", label: "Pull Requests creees", desc: "Notifier quand une PR est creee par l'agent Code" },
  { key: "notify_review_completed", label: "Reviews terminees", desc: "Notifier quand l'agent Review a termine son analyse" },
  { key: "notify_fix_applied", label: "Fixes appliques", desc: "Notifier quand l'agent Fix a pousse des corrections" },
] as const;

export default function SettingsNotifications({ settings, orgSlug, projectSlug }: { settings: ProjectSettings; orgSlug: string; projectSlug: string }) {
  const [channel, setChannel] = useState(settings.notification_channel_override ?? "");
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const update = useUpdateProjectSettings(orgSlug, projectSlug);

  useEffect(() => {
    setChannel(settings.notification_channel_override ?? "");
    const t: Record<string, boolean> = {};
    for (const toggle of TOGGLES) t[toggle.key] = (settings as any)[toggle.key];
    setToggles(t);
  }, [settings]);

  const handleSave = () => {
    update.mutate({ notification_channel_override: channel || null, ...toggles } as any);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#8b8b9e]">Canal par defaut (override l'organisation)</label>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#0c0c14] px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="">Utiliser le defaut orga</option>
          <option value="in_app">In-App</option>
          <option value="slack">Slack</option>
          <option value="email">Email</option>
        </select>
      </div>

      <div className="h-px bg-white/5" />

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Types de notifications actives</h3>
        {TOGGLES.map((t) => (
          <label key={t.key} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={toggles[t.key] ?? true}
              onChange={(e) => setToggles({ ...toggles, [t.key]: e.target.checked })}
              className="mt-0.5 accent-primary"
            />
            <div>
              <div className="text-sm text-foreground">{t.label}</div>
              <div className="text-xs text-[#8b8b9e]">{t.desc}</div>
            </div>
          </label>
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
