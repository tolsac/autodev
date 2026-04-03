import { useParams, useNavigate } from "react-router-dom";
import { useProjectSettings } from "@/hooks/use-project-settings";
import SettingsGeneral from "@/components/settings/project/SettingsGeneral";
import SettingsRepositories from "@/components/settings/project/SettingsRepositories";
import SettingsBoard from "@/components/settings/project/SettingsBoard";
import SettingsAgents from "@/components/settings/project/SettingsAgents";
import SettingsMembers from "@/components/settings/project/SettingsMembers";
import SettingsNotifications from "@/components/settings/project/SettingsNotifications";
import SettingsDanger from "@/components/settings/project/SettingsDanger";

const TABS = [
  { key: "general", label: "General" },
  { key: "repositories", label: "Repos" },
  { key: "board", label: "Board" },
  { key: "agents", label: "Agents IA" },
  { key: "members", label: "Membres" },
  { key: "notifications", label: "Notifs" },
  { key: "danger", label: "Danger" },
] as const;

export default function ProjectSettingsPage() {
  const { orgSlug, projectSlug, tab } = useParams<{
    orgSlug: string;
    projectSlug: string;
    tab?: string;
  }>();
  const navigate = useNavigate();
  const activeTab = tab ?? "general";

  const { data: settings, isLoading } = useProjectSettings(orgSlug!, projectSlug!);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Chargement...</div>;
  }
  if (!settings) {
    return <div className="flex h-full items-center justify-center text-destructive">Impossible de charger les settings.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-white/5 px-6 pt-5 pb-0">
        <div className="flex items-center gap-2 mb-4">
          <span className="flex h-6 w-6 items-center justify-center rounded text-xs" style={{ backgroundColor: settings.color + "30", color: settings.color }}>
            {settings.icon || settings.name[0]}
          </span>
          <h1 className="text-lg font-semibold text-foreground">{settings.name}</h1>
          <span className="text-sm text-[#8b8b9e]">— Settings</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 -mb-px">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => navigate(`/${orgSlug}/${projectSlug}/settings/${t.key}`)}
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
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {activeTab === "general" && <SettingsGeneral settings={settings} orgSlug={orgSlug!} projectSlug={projectSlug!} />}
        {activeTab === "repositories" && <SettingsRepositories settings={settings} orgSlug={orgSlug!} projectSlug={projectSlug!} />}
        {activeTab === "board" && <SettingsBoard orgSlug={orgSlug!} projectSlug={projectSlug!} />}
        {activeTab === "agents" && <SettingsAgents settings={settings} orgSlug={orgSlug!} projectSlug={projectSlug!} />}
        {activeTab === "members" && <SettingsMembers orgSlug={orgSlug!} projectSlug={projectSlug!} />}
        {activeTab === "notifications" && <SettingsNotifications settings={settings} orgSlug={orgSlug!} projectSlug={projectSlug!} />}
        {activeTab === "danger" && <SettingsDanger projectName={settings.name} orgSlug={orgSlug!} projectSlug={projectSlug!} />}
      </div>
    </div>
  );
}
