import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Project } from "@/types";
import { useAgentConfigs, AGENT_INFO, type AgentType } from "@/hooks/use-agent-configs";
import AgentConfigPanel from "@/components/agents/AgentConfigPanel";

const AGENT_TYPES: AgentType[] = ["challenge", "plan", "code", "review", "fix"];

export default function AgentsPage() {
  const { orgSlug, projectSlug, agentType } = useParams<{
    orgSlug: string;
    projectSlug: string;
    agentType?: string;
  }>();
  const navigate = useNavigate();
  const activeType = (agentType as AgentType) ?? "challenge";

  const { data: project } = useQuery<Project>({
    queryKey: ["project", orgSlug, projectSlug],
    queryFn: () => api.get<Project>(`/orgs/${orgSlug}/projects/${projectSlug}/`),
    enabled: !!orgSlug && !!projectSlug,
  });

  const { data: configs, isLoading } = useAgentConfigs(orgSlug!, projectSlug!);
  const activeConfig = configs?.find((c) => c.agent_type === activeType);

  if (isLoading) return <div className="flex h-full items-center justify-center text-muted-foreground">Chargement...</div>;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-white/5 px-6 pt-5 pb-0">
        <div className="mb-4 flex items-center gap-2">
          {project && (
            <span className="flex h-6 w-6 items-center justify-center rounded text-xs" style={{ backgroundColor: project.color + "30", color: project.color }}>
              {project.icon || project.name[0]}
            </span>
          )}
          <h1 className="text-lg font-semibold text-foreground">Agents</h1>
          {project && <span className="text-sm text-[#8b8b9e]">— {project.name}</span>}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 -mb-px">
          {AGENT_TYPES.map((type) => {
            const info = AGENT_INFO[type];
            const cfg = configs?.find((c) => c.agent_type === type);
            return (
              <button
                key={type}
                onClick={() => navigate(`/${orgSlug}/${projectSlug}/agents/${type}`)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  activeType === type ? "border-primary text-foreground" : "border-transparent text-[#8b8b9e] hover:text-foreground"
                }`}
              >
                {info.name}
                {cfg && !cfg.is_enabled && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#555566]" title="Desactive" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {activeConfig ? (
          <AgentConfigPanel config={activeConfig} orgSlug={orgSlug!} projectSlug={projectSlug!} />
        ) : (
          <div className="text-sm text-[#8b8b9e]">Configuration non trouvee pour cet agent.</div>
        )}
      </div>
    </div>
  );
}
