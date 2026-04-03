export default function OrgSettingsSecurity() {
  return (
    <div className="max-w-2xl">
      <div className="rounded-lg border border-white/5 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <svg className="size-5 text-[#8b8b9e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <h3 className="text-sm font-semibold text-foreground">Cette section arrive bientot</h3>
        </div>
        <p className="text-sm text-[#8b8b9e]">Les fonctionnalites de securite avancees sont en cours de developpement :</p>
        <ul className="space-y-1.5 text-sm text-[#8b8b9e]">
          <li>SSO / SAML (Enterprise)</li>
          <li>2FA obligatoire pour l'organisation</li>
          <li>Politique de mots de passe</li>
          <li>Duree et nombre de sessions</li>
          <li>IP allowlist</li>
        </ul>
        <p className="text-xs text-[#555566]">Interesse ? Contactez-nous a hello@autodev.com</p>
      </div>
    </div>
  );
}
