import { useState, useEffect } from "react";
import type { ProjectSettings } from "@/hooks/use-project-settings";
import { useUpdateProjectSettings, useArchiveProject } from "@/hooks/use-project-settings";

export default function SettingsGeneral({ settings, orgSlug, projectSlug }: { settings: ProjectSettings; orgSlug: string; projectSlug: string }) {
  const [name, setName] = useState(settings.name);
  const [description, setDescription] = useState(settings.description);
  const [icon, setIcon] = useState(settings.icon);
  const [color, setColor] = useState(settings.color);
  const [ticketPrefix, setTicketPrefix] = useState(settings.ticket_prefix);
  const update = useUpdateProjectSettings(orgSlug, projectSlug);
  const archive = useArchiveProject(orgSlug, projectSlug);

  useEffect(() => { setName(settings.name); setDescription(settings.description); setIcon(settings.icon); setColor(settings.color); setTicketPrefix(settings.ticket_prefix); }, [settings]);

  const inputClass = "h-10 w-full rounded-lg border border-foreground/10 bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
  const labelClass = "text-xs font-medium text-muted-foreground";

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className={labelClass}>Nom du projet</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputClass} h-auto py-2`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelClass}>Icone (emoji)</label>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="ex: 🚀" maxLength={4} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Couleur</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border border-foreground/10 bg-transparent" />
              <input value={color} onChange={(e) => setColor(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Prefixe des tickets</label>
          <input value={ticketPrefix} onChange={(e) => setTicketPrefix(e.target.value.toUpperCase())} maxLength={10} className={`${inputClass} w-32`} />
          <p className="text-[11px] text-muted-foreground">Modifier le prefixe n'affecte pas les tickets existants</p>
        </div>
        <p className="text-xs text-muted-foreground/60">Compteur de tickets : {settings.ticket_counter}</p>
        <div className="flex justify-end">
          <button onClick={() => update.mutate({ name, description, icon, color, ticket_prefix: ticketPrefix })} disabled={update.isPending} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {update.isPending ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      </div>

      <div className="h-px bg-foreground/5" />

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Archivage</h3>
        <p className="text-xs text-muted-foreground">
          {settings.is_archived ? "Ce projet est archive. Les donnees sont conservees." : "Ce projet est actuellement actif. Les projets archives disparaissent de la sidebar."}
        </p>
        <button onClick={() => archive.mutate(!settings.is_archived)} disabled={archive.isPending} className="h-9 rounded-lg border border-foreground/10 px-4 text-sm text-muted-foreground hover:text-foreground">
          {settings.is_archived ? "Restaurer le projet" : "Archiver le projet"}
        </button>
      </div>
    </div>
  );
}
