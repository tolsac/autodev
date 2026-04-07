import { useAuditLog } from "@/hooks/use-org-settings";

const ACTION_LABELS: Record<string, string> = {
  org_updated: "a modifie l'organisation",
  member_invited: "a invite un membre",
  member_removed: "a retire un membre",
  member_role_changed: "a change le role d'un membre",
  project_created: "a cree un projet",
  project_deleted: "a supprime un projet",
  repo_linked: "a lie un repository",
  repo_unlinked: "a delie un repository",
  scm_connected: "a connecte une forge Git",
  scm_disconnected: "a deconnecte une forge Git",
  plan_changed: "a change de plan",
  agent_triggered: "a lance un agent",
  agent_completed: "Agent termine",
};

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "a l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`;
  return `il y a ${Math.floor(seconds / 86400)}j`;
}

export default function OrgSettingsAudit({ orgSlug }: { orgSlug: string }) {
  const { data: logs, isLoading } = useAuditLog(orgSlug);

  if (isLoading) return <div className="text-muted-foreground">Chargement...</div>;

  return (
    <div className="max-w-2xl space-y-4">
      <h3 className="text-sm font-medium text-foreground">Journal d'audit</h3>

      {(!logs || logs.length === 0) ? (
        <p className="text-xs text-muted-foreground">Aucun evenement enregistre.</p>
      ) : (
        <div className="space-y-1">
          {logs.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 rounded-lg border border-foreground/5 px-4 py-3">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-foreground/5 text-[10px] font-medium text-foreground">
                {entry.user_name?.[0]?.toUpperCase() ?? "S"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground">
                  <span className="font-medium">{entry.user_name ?? "Systeme"}</span>{" "}
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </div>
                {entry.resource_type && (
                  <div className="text-xs text-muted-foreground">{entry.resource_type}</div>
                )}
              </div>
              <span className="flex-shrink-0 text-xs text-muted-foreground/60">{timeAgo(entry.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
