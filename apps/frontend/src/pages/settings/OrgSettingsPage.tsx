import { useParams, useNavigate } from "react-router-dom";
import { useOrgSettings } from "@/hooks/use-org-settings";
import OrgSettingsGeneral from "@/components/settings/org/OrgSettingsGeneral";
import OrgSettingsProjects from "@/components/settings/org/OrgSettingsProjects";
import OrgSettingsMembers from "@/components/settings/org/OrgSettingsMembers";
import OrgSettingsSCM from "@/components/settings/org/OrgSettingsSCM";
import OrgSettingsNotifications from "@/components/settings/org/OrgSettingsNotifications";
import OrgSettingsBilling from "@/components/settings/org/OrgSettingsBilling";
import OrgSettingsAudit from "@/components/settings/org/OrgSettingsAudit";
import OrgSettingsSecurity from "@/components/settings/org/OrgSettingsSecurity";
import OrgSettingsDanger from "@/components/settings/org/OrgSettingsDanger";

const TABS = [
  { key: "general", label: "General" },
  { key: "projects", label: "Projets" },
  { key: "members", label: "Membres" },
  { key: "scm", label: "Git" },
  { key: "notifications", label: "Notifs" },
  { key: "billing", label: "Billing" },
  { key: "audit", label: "Audit" },
  { key: "security", label: "Securite" },
  { key: "danger", label: "Danger" },
] as const;

export default function OrgSettingsPage() {
  const { orgSlug, tab } = useParams<{ orgSlug: string; tab?: string }>();
  const navigate = useNavigate();
  const activeTab = tab ?? "general";
  const { data: settings, isLoading } = useOrgSettings(orgSlug!);

  if (isLoading) return <div className="flex h-full items-center justify-center text-muted-foreground">Chargement...</div>;
  if (!settings) return <div className="flex h-full items-center justify-center text-destructive">Impossible de charger les settings.</div>;

  return (
    <div className="flex h-full flex-col">
      {/* Header with org branding */}
      <div className="border-b border-white/5 px-8 pt-5 pb-0">
        <button
          onClick={() => navigate(-1)}
          className="mb-3 flex items-center gap-1.5 text-xs text-[#8b8b9e] transition-colors hover:text-foreground"
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
          Retour
        </button>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#555566]">
          Organisation
        </div>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-sm font-bold text-primary">
            {settings.name[0]}
          </span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{settings.name}</h1>
            <p className="text-xs text-[#8b8b9e]">{settings.slug} &middot; {settings.member_count} membre{settings.member_count !== 1 ? "s" : ""} &middot; {settings.project_count} projet{settings.project_count !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 -mb-px">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => navigate(`/${orgSlug}/settings/${t.key}`)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-[#8b8b9e] hover:text-foreground"
              } ${t.key === "danger" ? "text-destructive/70 hover:text-destructive" : ""}`}
            >
              {t.key === "danger" ? "⚠" : t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {activeTab === "general" && <OrgSettingsGeneral settings={settings} orgSlug={orgSlug!} />}
        {activeTab === "projects" && <OrgSettingsProjects orgSlug={orgSlug!} />}
        {activeTab === "members" && <OrgSettingsMembers orgSlug={orgSlug!} />}
        {activeTab === "scm" && <OrgSettingsSCM orgSlug={orgSlug!} />}
        {activeTab === "notifications" && <OrgSettingsNotifications orgSlug={orgSlug!} />}
        {activeTab === "billing" && <OrgSettingsBilling orgSlug={orgSlug!} />}
        {activeTab === "audit" && <OrgSettingsAudit orgSlug={orgSlug!} />}
        {activeTab === "security" && <OrgSettingsSecurity />}
        {activeTab === "danger" && <OrgSettingsDanger orgName={settings.name} orgSlug={orgSlug!} />}
      </div>
    </div>
  );
}
