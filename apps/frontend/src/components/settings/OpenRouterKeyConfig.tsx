import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  level: "organization" | "project";
  orgSlug: string;
  hasKey: boolean;
  keyPreview: string;
  effectiveSource?: "project" | "organization" | "none";
  onSave: (apiKey: string) => Promise<void>;
  onClear: () => Promise<void>;
}

export default function OpenRouterKeyConfig({
  level,
  orgSlug,
  hasKey,
  keyPreview,
  effectiveSource,
  onSave,
  onClear,
}: Props) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [editing, setEditing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; label?: string; usage?: number; limit?: number | null; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [useOverride, setUseOverride] = useState(hasKey && level === "project");

  const handleValidate = async () => {
    if (!apiKey) return;
    setValidating(true);
    setValidation(null);
    try {
      const result = await api.post<any>(`/orgs/${orgSlug}/openrouter/validate/`, { api_key: apiKey });
      setValidation(result);
    } catch {
      setValidation({ valid: false, error: "Impossible de valider la cle." });
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(apiKey);
      setEditing(false);
      setApiKey("");
      setValidation(null);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    await onClear();
    setEditing(false);
    setApiKey("");
    setValidation(null);
    setUseOverride(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Cle API OpenRouter {level === "project" ? "(override projet)" : ""}
          </h4>
          <p className="mt-0.5 text-xs text-[#8b8b9e]">
            {level === "organization"
              ? "Utilisee par tous les projets de l'organisation."
              : "Surcharge la cle de l'organisation pour ce projet."}
          </p>
        </div>
        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
          Obtenir une cle
        </a>
      </div>

      {/* Effective source indicator (project level only) */}
      {level === "project" && effectiveSource && (
        <div className={`rounded-lg px-3 py-2 text-xs ${
          effectiveSource === "none" ? "bg-destructive/10 text-destructive" : "bg-white/5 text-[#8b8b9e]"
        }`}>
          {effectiveSource === "organization" && `Cle effective : Organisation (${keyPreview || "configuree"})`}
          {effectiveSource === "project" && `Cle effective : Ce projet (${keyPreview})`}
          {effectiveSource === "none" && "Aucune cle configuree — les agents ne peuvent pas fonctionner."}
        </div>
      )}

      {/* Project: toggle override */}
      {level === "project" && (
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input type="checkbox" checked={useOverride} onChange={(e) => {
            setUseOverride(e.target.checked);
            if (!e.target.checked && hasKey) handleClear();
          }} className="accent-primary" />
          Utiliser une cle specifique pour ce projet
        </label>
      )}

      {/* Key input (shown for org always, for project only when override enabled) */}
      {(level === "organization" || useOverride) && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={editing ? apiKey : (hasKey ? keyPreview : "")}
                onChange={(e) => { setApiKey(e.target.value); setValidation(null); }}
                onFocus={() => { if (!editing) { setEditing(true); setApiKey(""); } }}
                placeholder="sk-or-v1-..."
                className="h-10 w-full rounded-lg border border-white/10 bg-[#0c0c14] px-3 pr-10 text-sm text-foreground placeholder:text-[#555566] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8b8b9e] hover:text-foreground">
                {showKey ? (
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>

          {/* Validation result */}
          {validation && (
            <div className={`rounded-lg px-3 py-2 text-xs ${validation.valid ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}`}>
              {validation.valid ? (
                <>Cle valide{validation.label ? ` — ${validation.label}` : ""}{validation.usage !== undefined ? ` | Usage: $${validation.usage}` : ""}{validation.limit ? ` / $${validation.limit}` : ""}</>
              ) : (
                validation.error
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={handleValidate} disabled={validating || !apiKey} className="h-8 rounded-lg border border-white/10 px-3 text-xs text-[#8b8b9e] hover:text-foreground disabled:opacity-50">
              {validating ? "Verification..." : "Tester la cle"}
            </button>
            <button onClick={handleSave} disabled={saving || !apiKey} className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
            {hasKey && level === "organization" && (
              <button onClick={handleClear} className="h-8 rounded-lg border border-destructive/30 px-3 text-xs text-destructive hover:bg-destructive/10">
                Supprimer la cle
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
