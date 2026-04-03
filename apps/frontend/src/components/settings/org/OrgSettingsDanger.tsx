import { useState } from "react";
import { useDeleteOrg } from "@/hooks/use-org-settings";

export default function OrgSettingsDanger({ orgName, orgSlug }: { orgName: string; orgSlug: string }) {
  const [confirmName, setConfirmName] = useState("");
  const deleteOrg = useDeleteOrg(orgSlug);
  const isMatch = confirmName === orgName;

  return (
    <div className="max-w-2xl">
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <svg className="size-5 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
          <h3 className="text-sm font-semibold text-destructive">Supprimer cette organisation</h3>
        </div>
        <p className="text-sm text-foreground/70">
          Cette action est irreversible. Tous les projets, tickets, donnees d'agents et historiques seront definitivement supprimes. L'abonnement Stripe sera automatiquement annule.
        </p>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#8b8b9e]">Pour confirmer, tapez le nom de l'organisation : <strong className="text-foreground">{orgName}</strong></label>
          <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={orgName} className="h-10 w-full rounded-lg border border-destructive/30 bg-[#0c0c14] px-3 text-sm text-foreground focus:border-destructive focus:outline-none focus:ring-1 focus:ring-destructive/50" />
        </div>
        <div className="flex justify-end">
          <button onClick={() => deleteOrg.mutate(confirmName)} disabled={!isMatch || deleteOrg.isPending} className="h-9 rounded-lg bg-destructive px-4 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-30">
            {deleteOrg.isPending ? "Suppression..." : "Supprimer l'organisation"}
          </button>
        </div>
      </div>
    </div>
  );
}
