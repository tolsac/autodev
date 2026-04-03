import { useState } from "react";
import { useOrgMembers, useOrgInvitations, useUpdateMemberRole, useRemoveMember, useCreateInvitation } from "@/hooks/use-org-settings";

export default function OrgSettingsMembers({ orgSlug }: { orgSlug: string }) {
  const { data: members, isLoading } = useOrgMembers(orgSlug);
  const { data: invitations } = useOrgInvitations(orgSlug);
  const updateRole = useUpdateMemberRole(orgSlug);
  const removeMember = useRemoveMember(orgSlug);
  const createInvite = useCreateInvitation(orgSlug);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  if (isLoading) return <div className="text-muted-foreground">Chargement...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Membres ({members?.length ?? 0})</h3>
        <button onClick={() => setInviteOpen(true)} className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90">+ Inviter</button>
      </div>

      <div className="space-y-1">
        {members?.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-lg border border-white/5 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
              {m.user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-foreground truncate">{m.user.full_name}</div>
              <div className="text-xs text-[#8b8b9e] truncate">{m.user.email}</div>
            </div>
            {m.role === "owner" ? (
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Owner</span>
            ) : (
              <>
                <select value={m.role} onChange={(e) => updateRole.mutate({ userId: m.user.id, role: e.target.value })} className="h-8 rounded-lg border border-white/10 bg-[#0c0c14] px-2 text-xs text-foreground">
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
                <button onClick={() => removeMember.mutate(m.user.id)} className="text-[#8b8b9e] hover:text-destructive">
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {invitations && invitations.filter((i) => i.status === "pending").length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-[#8b8b9e]">Invitations en attente</h4>
          {invitations.filter((i) => i.status === "pending").map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 rounded-lg border border-white/5 px-4 py-2 text-xs">
              <span className="text-foreground">{inv.email}</span>
              <span className="text-[#8b8b9e] capitalize">{inv.role}</span>
              {inv.is_guest && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[#8b8b9e]">Guest</span>}
              <span className="ml-auto text-[#555566]">Expire le {new Date(inv.expires_at).toLocaleDateString("fr-FR")}</span>
            </div>
          ))}
        </div>
      )}

      {/* Invite modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setInviteOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-white/5 bg-[#13131d] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-foreground">Inviter un membre</h3>
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@example.com" className="h-10 w-full rounded-lg border border-white/10 bg-[#0c0c14] px-3 text-sm text-foreground" />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#0c0c14] px-3 text-sm text-foreground">
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setInviteOpen(false)} className="h-9 rounded-lg border border-white/10 px-4 text-sm text-[#8b8b9e]">Annuler</button>
              <button onClick={() => { createInvite.mutate({ email: inviteEmail, role: inviteRole }); setInviteOpen(false); setInviteEmail(""); }} disabled={!inviteEmail} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">Envoyer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
