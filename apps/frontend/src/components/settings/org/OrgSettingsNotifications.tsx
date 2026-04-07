export default function OrgSettingsNotifications({ orgSlug: _orgSlug }: { orgSlug: string }) {
  return (
    <div className="max-w-2xl space-y-6">
      <h3 className="text-sm font-medium text-foreground">Canaux de notification</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border border-foreground/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm">🔔</span>
            <div>
              <div className="text-sm text-foreground">In-App</div>
              <div className="text-xs text-muted-foreground">Toujours disponible</div>
            </div>
          </div>
          <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Defaut</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-foreground/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm">💬</span>
            <div>
              <div className="text-sm text-foreground">Slack</div>
              <div className="text-xs text-muted-foreground">Non configure</div>
            </div>
          </div>
          <button className="h-7 rounded-md border border-foreground/10 px-2.5 text-xs text-muted-foreground hover:text-foreground">Configurer</button>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-foreground/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm">📧</span>
            <div>
              <div className="text-sm text-foreground">Email</div>
              <div className="text-xs text-muted-foreground">Non configure</div>
            </div>
          </div>
          <button className="h-7 rounded-md border border-foreground/10 px-2.5 text-xs text-muted-foreground hover:text-foreground">Configurer</button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground/60">Le canal par defaut est utilise quand un agent envoie une notification, sauf override par projet ou par utilisateur.</p>
    </div>
  );
}
