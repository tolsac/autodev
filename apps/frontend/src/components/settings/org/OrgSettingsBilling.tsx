import { useBilling } from "@/hooks/use-org-settings";

const PLANS = [
  { key: "free", name: "Free", price: "0", runs: 50 },
  { key: "starter", name: "Starter", price: "19", runs: 300 },
  { key: "pro", name: "Pro", price: "49", runs: 1500 },
  { key: "enterprise", name: "Enterprise", price: "Sur devis", runs: -1 },
];

function ProgressBar({ current, max, label }: { current: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const color = pct > 95 ? "bg-destructive" : pct > 80 ? "bg-yellow-500" : "bg-primary";
  return (
    <div className="rounded-lg border border-white/5 p-4">
      <div className="mb-1 text-xs text-[#8b8b9e]">{label}</div>
      <div className="text-lg font-semibold text-foreground">{current}/{max}</div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-white/5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function OrgSettingsBilling({ orgSlug }: { orgSlug: string }) {
  const { data: billing, isLoading } = useBilling(orgSlug);

  if (isLoading) return <div className="text-muted-foreground">Chargement...</div>;
  if (!billing) return <div className="text-[#8b8b9e]">Impossible de charger les donnees de facturation.</div>;

  const currentPlan = PLANS.find((p) => p.key === billing.plan) ?? PLANS[0];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Current plan */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{currentPlan.name}</h3>
            <p className="text-sm text-[#8b8b9e]">{currentPlan.price === "Sur devis" ? currentPlan.price : `${currentPlan.price}\u20ac/mois`}</p>
            {billing.current_period_end && (
              <p className="mt-1 text-xs text-[#555566]">Renouvellement : {new Date(billing.current_period_end).toLocaleDateString("fr-FR")}</p>
            )}
          </div>
          <button className="h-9 rounded-lg border border-white/10 px-4 text-sm text-[#8b8b9e] hover:text-foreground">Gerer le paiement</button>
        </div>
      </div>

      {/* Usage bars */}
      <div className="grid grid-cols-3 gap-3">
        <ProgressBar current={billing.max_members > 0 ? Math.min(3, billing.max_members) : 0} max={billing.max_members} label="Membres" />
        <ProgressBar current={billing.max_projects > 0 ? Math.min(2, billing.max_projects) : 0} max={billing.max_projects} label="Projets" />
        <ProgressBar current={billing.current_ai_runs_count} max={billing.max_ai_runs_per_month} label="AI Runs ce mois" />
      </div>

      <div className="h-px bg-white/5" />

      {/* Plan cards */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Changer de plan</h3>
        <div className="grid grid-cols-4 gap-2">
          {PLANS.map((plan) => (
            <div key={plan.key} className={`rounded-lg border p-4 text-center ${plan.key === billing.plan ? "border-primary bg-primary/5" : "border-white/5"}`}>
              <div className="text-sm font-semibold text-foreground">{plan.name}</div>
              <div className="mt-1 text-xs text-[#8b8b9e]">{plan.price === "Sur devis" ? plan.price : `${plan.price}\u20ac`}</div>
              {plan.runs > 0 && <div className="mt-1 text-[10px] text-[#555566]">{plan.runs} runs/mois</div>}
              {plan.key === billing.plan ? (
                <div className="mt-3 text-xs text-primary">Plan actuel</div>
              ) : plan.key === "enterprise" ? (
                <button className="mt-3 h-7 w-full rounded-md border border-white/10 text-xs text-[#8b8b9e]">Contact</button>
              ) : (
                <button className="mt-3 h-7 w-full rounded-md bg-primary/10 text-xs text-primary hover:bg-primary/20">Choisir</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/5" />
      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground">Historique des factures</h3>
        <p className="text-xs text-[#8b8b9e]">L'historique sera disponible apres la configuration de Stripe.</p>
      </div>
    </div>
  );
}
