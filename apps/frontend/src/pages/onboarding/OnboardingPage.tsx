import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type { Organization, SCMConnection, Repository } from "@/types";

const STEPS = [
  { number: 1, label: "Organisation" },
  { number: 2, label: "Git Forge" },
  { number: 3, label: "Premier Projet" },
] as const;

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [org, setOrg] = useState<Organization | null>(null);
  const [connections, setConnections] = useState<SCMConnection[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <span className="text-sm font-bold text-foreground">Autodev</span>
        <div className="flex items-center gap-2">
          <button className="h-8 w-8 rounded-full border border-border text-muted-foreground hover:text-foreground">
            ?
          </button>
        </div>
      </header>

      {/* Stepper */}
      <div className="mx-auto mt-10 w-full max-w-xl px-4">
        {/* Line + circles row */}
        <div className="relative flex items-center justify-between">
          {/* Background line (full width, behind circles) */}
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border" />
          {/* Progress line (colored portion) */}
          <div
            className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-primary transition-all duration-300"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
          />

          {/* Circles */}
          {STEPS.map((s) => (
            <div
              key={s.number}
              className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                step >= s.number
                  ? "bg-primary text-primary-foreground"
                  : "border-2 border-border bg-background text-muted-foreground"
              }`}
            >
              {s.number}
            </div>
          ))}
        </div>

        {/* Labels row (below the line) */}
        <div className="mt-2 flex justify-between">
          {STEPS.map((s) => (
            <span
              key={s.number}
              className={`text-xs ${
                step >= s.number ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Etape {s.number}: {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto mt-8 w-full max-w-lg px-4 pb-12">
        <div className="rounded-xl border border-border bg-accent/50 p-8">
          {step === 1 && (
            <Step1
              onComplete={(newOrg) => {
                setOrg(newOrg);
                setStep(2);
              }}
            />
          )}
          {step === 2 && org && (
            <Step2
              org={org}
              connections={connections}
              setConnections={setConnections}
              setRepos={setRepos}
              onNext={() => setStep(3)}
              onSkip={() => setStep(3)}
            />
          )}
          {step === 3 && org && (
            <Step3
              org={org}
              repos={repos}
              onComplete={(projectSlug) => {
                navigate(`/${org.slug}/${projectSlug}/board`);
              }}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        &copy; 2024 Autodev SaaS. All rights reserved. &middot; Terms of
        Service &middot; Privacy Policy &middot; Documentation
      </footer>
    </div>
  );
}

/* ─── Step 1: Create Organization ─── */

function Step1({
  onComplete,
}: {
  onComplete: (org: Organization) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const org = await api.post<Organization>("/orgs/", { name, slug });
      onComplete(org);
    } catch {
      setError("Impossible de creer l'organisation.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Bienvenue sur Autodev
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Commencons par configurer l'espace de travail pour votre equipe.
        </p>
      </div>

      {/* Logo upload */}
      <div className="flex flex-col items-center gap-1">
        <label className="group cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) {
                setError("Le fichier ne doit pas depasser 2 Mo.");
                return;
              }
              const reader = new FileReader();
              reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
              reader.readAsDataURL(file);
            }}
          />
          {logoPreview ? (
            <img
              src={logoPreview}
              alt="Logo"
              className="h-20 w-20 rounded-full border-2 border-primary object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="mt-0.5 text-[10px]">Logo</span>
            </div>
          )}
        </label>
        <p className="text-xs text-muted-foreground">
          Optionnel (max 2Mo)
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Org Name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Nom de l'organisation
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Acme Inc."
          required
          className="h-10 w-full rounded-lg border border-border bg-accent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          URL de l'espace
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="acme-inc"
          required
          pattern="[a-z0-9-]+"
          className="h-10 w-full rounded-lg border border-border bg-accent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="text-xs text-muted-foreground">
          ex: app.autodev.com/{" "}
          <span className="text-primary">{slug || "acme-inc"}</span>
        </p>
      </div>

      <button
        type="submit"
        disabled={isLoading || !name || !slug}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isLoading ? "Creation..." : "Suivant"}
        {!isLoading && <span>&rarr;</span>}
      </button>

      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Donnees securisees
        </span>
        <span className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
          RGPD Compliant
        </span>
      </div>
    </form>
  );
}

/* ─── Step 2: Connect Git Forge ─── */

function Step2({
  org,
  connections,
  setConnections,
  setRepos,
  onNext,
  onSkip,
}: {
  org: Organization;
  connections: SCMConnection[];
  setConnections: (c: SCMConnection[]) => void;
  setRepos: (r: Repository[]) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [isConnecting, setIsConnecting] = useState<string | null>(null);

  const providers = [
    {
      type: "github" as const,
      name: "GitHub",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      ),
    },
    {
      type: "bitbucket" as const,
      name: "Bitbucket",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
        </svg>
      ),
    },
    {
      type: "gitlab" as const,
      name: "GitLab",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
        </svg>
      ),
    },
  ];

  const isConnected = (type: string) =>
    connections.some((c) => c.provider_type === type);

  const handleConnect = async (type: string) => {
    setIsConnecting(type);
    try {
      const conn = await api.post<SCMConnection>(
        `/orgs/${org.slug}/scm-connections/`,
        { provider_type: type },
      );
      setConnections([...connections, conn]);
      // Fetch available repos
      const availableRepos = await api.get<Repository[]>(
        `/orgs/${org.slug}/repositories/`,
      );
      setRepos(availableRepos);
    } catch {
      // OAuth flow would redirect — for now just simulate
    } finally {
      setIsConnecting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Connecter votre forge Git
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selectionnez votre plateforme pour importer vos depots.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {providers.map((p) => (
          <button
            key={p.type}
            onClick={() => !isConnected(p.type) && handleConnect(p.type)}
            disabled={isConnecting !== null}
            className={`flex flex-col items-center gap-3 rounded-xl border p-6 text-sm transition-all ${
              isConnected(p.type)
                ? "border-primary/50 bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            {p.icon}
            <span className="font-medium">{p.name}</span>
            {isConnected(p.type) && (
              <span className="text-xs text-primary">Connecte</span>
            )}
            {isConnecting === p.type && (
              <span className="text-xs">Connexion...</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Passer cette etape
        </button>
        <button
          onClick={onNext}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Suivant <span>&rarr;</span>
        </button>
      </div>
    </div>
  );
}

/* ─── Step 3: Create First Project ─── */

function Step3({
  org,
  repos,
  onComplete,
}: {
  org: Organization;
  repos: Repository[];
  onComplete: (projectSlug: string) => void;
}) {
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleNameChange = (value: string) => {
    setName(value);
    const p = value
      .split(/[\s-_]+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 4);
    setPrefix(p || "AD");
  };

  const toggleRepo = (id: string) => {
    setSelectedRepos((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const project = await api.post<{ slug: string }>(
        `/orgs/${org.slug}/projects/`,
        { name, slug, ticket_prefix: prefix },
      );
      // Link selected repos
      for (const repoId of selectedRepos) {
        await api.post(
          `/orgs/${org.slug}/projects/${project.slug}/repositories/`,
          { repository_id: repoId },
        );
      }
      onComplete(project.slug);
    } catch {
      setError("Impossible de creer le projet.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Creer votre premier projet
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurez votre projet et selectionnez les depots associes.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Project Name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Nom du projet
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Autodev API"
          required
          className="h-10 w-full rounded-lg border border-border bg-accent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Ticket Prefix */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Prefixe des tickets
        </label>
        <input
          type="text"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value.toUpperCase().slice(0, 4))}
          placeholder="AD"
          required
          maxLength={4}
          className="h-10 w-32 rounded-lg border border-border bg-accent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="text-xs text-muted-foreground">
          Les tickets seront nommes {prefix || "AD"}-1, {prefix || "AD"}-2, ...
        </p>
      </div>

      {/* Repos */}
      {repos.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Depots a lier
          </label>
          <div className="space-y-1.5">
            {repos.map((repo) => (
              <label
                key={repo.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selectedRepos.includes(repo.id)}
                  onChange={() => toggleRepo(repo.id)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-sm text-foreground">
                  {repo.full_name}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {repos.length === 0 && (
        <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          Aucun depot disponible. Vous pourrez en connecter plus tard dans les
          settings du projet.
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !name}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isLoading ? "Creation..." : "Commencer"}
        {!isLoading && <span>&rarr;</span>}
      </button>
    </form>
  );
}
