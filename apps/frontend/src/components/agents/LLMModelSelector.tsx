import { useState, useMemo } from "react";
import { useLLMModels, type LLMModel } from "@/hooks/use-agent-configs";

function formatCtx(n: number): string {
  return n >= 1000000 ? `${n / 1000000}M` : `${n / 1000}K`;
}

export default function LLMModelSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data: models } = useLLMModels();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    if (!models) return {};
    const filtered = search
      ? models.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.provider.toLowerCase().includes(search.toLowerCase()))
      : models;
    const groups: Record<string, LLMModel[]> = {};
    for (const m of filtered) {
      (groups[m.provider] ??= []).push(m);
    }
    return groups;
  }, [models, search]);

  const selectedModel = models?.find((m) => m.id === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-foreground/10 bg-surface px-3 py-2.5 text-left text-sm text-foreground hover:border-foreground/20"
      >
        <div>
          <span className="font-medium">{selectedModel?.name ?? value}</span>
          {selectedModel && (
            <span className="ml-2 text-xs text-muted-foreground">
              ${selectedModel.input_price_per_m} / ${selectedModel.output_price_per_m} per M &middot; {formatCtx(selectedModel.context_window)} ctx
            </span>
          )}
        </div>
        <svg className="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-foreground/10 bg-surface-elevated shadow-xl">
          <div className="border-b border-foreground/5 p-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un modele..."
              autoFocus
              className="h-8 w-full rounded-md border border-foreground/10 bg-surface px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {Object.entries(grouped).map(([provider, providerModels]) => (
              <div key={provider}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{provider}</div>
                {providerModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { onChange(m.id); setOpen(false); setSearch(""); }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-foreground/5 ${m.id === value ? "bg-foreground/[0.03]" : ""}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${m.id === value ? "bg-primary" : "bg-transparent"}`} />
                    <span className="flex-1 text-foreground">{m.name}</span>
                    <span className="text-[10px] text-muted-foreground/60">
                      ${m.input_price_per_m} / ${m.output_price_per_m}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">{formatCtx(m.context_window)}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
