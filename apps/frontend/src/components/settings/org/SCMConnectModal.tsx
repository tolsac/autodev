import { useStartGitHubInstall } from "@/hooks/use-scm";

export default function SCMConnectModal({ orgSlug, open, onClose }: { orgSlug: string; open: boolean; onClose: () => void }) {
  const install = useStartGitHubInstall(orgSlug);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-white/5 bg-[#13131d] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Connecter une forge Git</h2>
          <button onClick={onClose} className="text-[#8b8b9e] hover:text-foreground">
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-6">
          <p className="mb-4 text-sm text-[#8b8b9e]">Choisissez votre fournisseur de code source :</p>
          <div className="grid grid-cols-3 gap-3">
            {/* GitHub */}
            <div className="flex flex-col items-center gap-3 rounded-lg border border-white/10 p-5 transition-colors hover:border-primary/30">
              <svg className="size-8 text-foreground" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
              <span className="text-sm font-medium text-foreground">GitHub</span>
              <button onClick={() => install.mutate()} disabled={install.isPending} className="h-8 w-full rounded-lg bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {install.isPending ? "Redirection..." : "Connecter"}
              </button>
            </div>
            {/* Bitbucket */}
            <div className="flex flex-col items-center gap-3 rounded-lg border border-white/5 p-5 opacity-40">
              <svg className="size-8 text-[#8b8b9e]" viewBox="0 0 24 24" fill="currentColor"><path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" /></svg>
              <span className="text-sm font-medium text-[#8b8b9e]">Bitbucket</span>
              <span className="text-[10px] text-[#555566]">Coming soon</span>
            </div>
            {/* GitLab */}
            <div className="flex flex-col items-center gap-3 rounded-lg border border-white/5 p-5 opacity-40">
              <svg className="size-8 text-[#8b8b9e]" viewBox="0 0 24 24" fill="currentColor"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" /></svg>
              <span className="text-sm font-medium text-[#8b8b9e]">GitLab</span>
              <span className="text-[10px] text-[#555566]">Coming soon</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-[#555566]">En connectant GitHub, vous installerez l'application Autodev sur votre organisation GitHub. Vous pourrez choisir les repositories auxquels donner acces.</p>
        </div>
      </div>
    </div>
  );
}
