import { useProjectMembers } from "@/hooks/use-project-data";

export default function SettingsMembers({ orgSlug, projectSlug }: { orgSlug: string; projectSlug: string }) {
  const { data: members, isLoading } = useProjectMembers(orgSlug, projectSlug);

  if (isLoading) return <div className="text-muted-foreground">Chargement...</div>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Membres du projet</h3>
      </div>
      <div className="space-y-1">
        {members?.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-lg border border-foreground/5 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
              {m.user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-foreground truncate">{m.user.full_name}</div>
              <div className="text-xs text-muted-foreground truncate">{m.user.email}</div>
            </div>
            <span className="rounded bg-foreground/5 px-2 py-0.5 text-xs text-muted-foreground capitalize">{m.role}</span>
          </div>
        ))}
        {(!members || members.length === 0) && (
          <p className="text-xs text-muted-foreground">Aucun membre dans ce projet.</p>
        )}
      </div>
    </div>
  );
}
