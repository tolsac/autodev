import { useState, useEffect } from "react";
import type { OrgSettings } from "@/hooks/use-org-settings";
import { useUpdateOrgSettings } from "@/hooks/use-org-settings";
import OpenRouterKeyConfig from "@/components/settings/OpenRouterKeyConfig";

export default function OrgSettingsGeneral({ settings, orgSlug }: { settings: OrgSettings; orgSlug: string }) {
  const [name, setName] = useState(settings.name);
  const [tz, setTz] = useState(settings.timezone);
  const [channel, setChannel] = useState(settings.default_notification_channel);
  const update = useUpdateOrgSettings(orgSlug);

  useEffect(() => { setName(settings.name); setTz(settings.timezone); setChannel(settings.default_notification_channel); }, [settings]);

  const timezones: string[] = (() => { try { return (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf("timeZone"); } catch { return ["Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "UTC"]; } })();

  const inputClass = "h-10 w-full rounded-lg border border-foreground/10 bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Nom de l'organisation</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Slug</label>
          <p className="text-sm text-muted-foreground/60">{settings.slug} (non modifiable)</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Fuseau horaire</label>
          <select value={tz} onChange={(e) => setTz(e.target.value)} className={inputClass}>
            {timezones.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Canal de notification par defaut</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClass}>
            <option value="in_app">In-App</option>
            <option value="slack">Slack</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div className="flex justify-end">
          <button onClick={() => update.mutate({ name, timezone: tz, default_notification_channel: channel })} disabled={update.isPending} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {update.isPending ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      </div>
      <div className="rounded-lg border border-foreground/5 p-4 text-xs text-muted-foreground">
        <p>{settings.member_count} membre{settings.member_count !== 1 ? "s" : ""} &middot; {settings.project_count} projet{settings.project_count !== 1 ? "s" : ""} actif{settings.project_count !== 1 ? "s" : ""}</p>
      </div>

      <div className="h-px bg-foreground/5" />

      <OpenRouterKeyConfig
        level="organization"
        orgSlug={orgSlug}
        hasKey={(settings as any).has_openrouter_key ?? false}
        keyPreview={(settings as any).openrouter_api_key_preview ?? ""}
        onSave={async (key) => { update.mutate({ openrouter_api_key: key } as any); }}
        onClear={async () => { update.mutate({ openrouter_api_key: "" } as any); }}
      />
    </div>
  );
}
