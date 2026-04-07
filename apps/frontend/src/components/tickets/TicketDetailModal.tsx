import { useState } from "react";
import { useTicketDetail, type CommentItem } from "@/hooks/use-tickets";
import MarkdownRenderer from "@/components/shared/MarkdownRenderer";
import PriorityIndicator from "./PriorityIndicator";
import AgentStatusBadges from "./AgentStatusBadges";
import TicketCreateModal from "./TicketCreateModal";
import ImpactedReposEditor from "./ImpactedReposEditor";

export default function TicketDetailModal({
  orgSlug,
  projectSlug,
  ticketKey,
  onClose,
}: {
  orgSlug: string;
  projectSlug: string;
  ticketKey: string | null;
  onClose: () => void;
}) {
  const { data: ticket, isLoading } = useTicketDetail(orgSlug, projectSlug, ticketKey);
  const [editOpen, setEditOpen] = useState(false);

  if (!ticketKey) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative z-10 flex h-[80vh] w-full max-w-[900px] flex-col rounded-xl border border-foreground/5 bg-background shadow-2xl">
        {isLoading || !ticket ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Chargement...
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-foreground/5 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-muted-foreground">{ticket.ticket_key}</span>
                <h2 className="text-lg font-semibold text-foreground">{ticket.title}</h2>
              </div>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>

            {/* Body: main + sidebar */}
            <div className="flex flex-1 overflow-hidden">
              {/* Main content: flex column so footer sticks to bottom */}
              <div className="flex flex-1 flex-col">
                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                  {ticket.description && (
                    <section>
                      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</h3>
                      <MarkdownRenderer content={ticket.description} />
                    </section>
                  )}

                  {ticket.acceptance_criteria && (
                    <section>
                      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Criteres d'acceptation</h3>
                      <MarkdownRenderer content={ticket.acceptance_criteria} />
                    </section>
                  )}

                  <section>
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Statuts agents</h3>
                    <AgentStatusBadges
                      statuses={{
                        challenge_status: ticket.challenge_status,
                        plan_status: ticket.plan_status,
                        code_status: ticket.code_status,
                        review_status: ticket.review_status,
                        fix_status: ticket.fix_status,
                      }}
                      showLabels
                    />
                  </section>

                  {ticket.comments && ticket.comments.length > 0 && (
                    <section>
                      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Commentaires ({ticket.comments.length})
                      </h3>
                      <div className="space-y-3">
                        {ticket.comments.map((comment) => (
                          <CommentBlock key={comment.id} comment={comment} />
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                {/* Sticky bottom edit button */}
                <div className="flex-shrink-0 border-t border-foreground/5 bg-background px-6 py-3">
                  <button
                    onClick={() => setEditOpen(true)}
                    className="flex h-9 items-center gap-2 rounded-lg border border-foreground/10 px-4 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                  >
                    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                    Modifier
                  </button>
                </div>
              </div>

              {/* Sidebar (fixed) */}
              <div className="w-[280px] flex-shrink-0 border-l border-foreground/5 overflow-y-auto px-5 py-4 space-y-4 text-sm">
                <SidebarField label="Colonne">
                  <span className="inline-block rounded bg-foreground/5 px-2 py-0.5 text-xs font-medium" style={{ borderLeft: `3px solid ${(ticket.column as any)?.color ?? "#6B7280"}` }}>
                    {(ticket.column as any)?.name ?? "—"}
                  </span>
                </SidebarField>

                <SidebarField label="Priorite">
                  <PriorityIndicator priority={ticket.priority} showLabel />
                </SidebarField>

                <SidebarField label="Assigne">
                  {ticket.assigned_to ? (
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-medium text-primary">
                        {ticket.assigned_to.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-foreground">{ticket.assigned_to.full_name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Non assigne</span>
                  )}
                </SidebarField>

                <SidebarField label="Complexite">
                  <span className="text-foreground">{ticket.estimated_complexity?.toUpperCase() || "—"}</span>
                </SidebarField>

                <SidebarField label="Labels">
                  {ticket.labels.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {ticket.labels.map((l) => (
                        <span key={l.id} className="rounded-md px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: l.color + "20", color: l.color }}>
                          {l.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </SidebarField>

                <div className="h-px bg-foreground/5" />

                <ImpactedReposEditor
                  orgSlug={orgSlug}
                  projectSlug={projectSlug}
                  ticketKey={ticketKey!}
                  impactedRepos={ticket.impacted_repos ?? []}
                  availableRepos={(ticket as any).available_repos ?? []}
                />

                <div className="h-px bg-foreground/5" />

                <SidebarField label="Cree par">
                  <span className="text-foreground">{ticket.created_by?.full_name ?? "—"}</span>
                </SidebarField>

                <SidebarField label="Cree le">
                  <span className="text-foreground">{new Date(ticket.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span>
                </SidebarField>

                <SidebarField label="Mis a jour">
                  <span className="text-foreground">{timeAgo(ticket.updated_at)}</span>
                </SidebarField>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit modal */}
      {ticket && (
        <TicketCreateModal
          orgSlug={orgSlug}
          projectSlug={projectSlug}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          ticket={ticket}
          onSuccess={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function CommentBlock({ comment, depth = 0 }: { comment: CommentItem; depth?: number }) {
  const isAgent = comment.author_type === "agent";
  return (
    <div className={depth > 0 ? "ml-4 border-l border-foreground/5 pl-3" : ""}>
      <div className={`rounded-lg p-3 ${isAgent ? "bg-primary/5" : "bg-foreground/[0.02]"}`}>
        <div className="flex items-center gap-2 text-xs">
          {isAgent ? (
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 text-[9px] font-bold text-primary">AI</span>
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10 text-[9px] font-medium text-foreground">
              {(comment.author?.full_name ?? "?")[0].toUpperCase()}
            </span>
          )}
          <span className="font-medium text-foreground">
            {isAgent ? `${comment.agent_type ?? "Agent"} Agent` : comment.author?.full_name ?? "Inconnu"}
          </span>
          <span className="text-muted-foreground">
            {timeAgo(comment.created_at)}
          </span>
          {comment.is_question && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${comment.is_resolved ? "bg-green-500/10 text-green-500" : "bg-orange-500/10 text-orange-500"}`}>
              {comment.is_resolved ? "Resolu" : "Question"}
            </span>
          )}
        </div>
        <div className="mt-2 text-sm">
          <MarkdownRenderer content={comment.body} />
        </div>
      </div>
      {comment.replies?.map((reply) => (
        <CommentBlock key={reply.id} comment={reply} depth={depth + 1} />
      ))}
    </div>
  );
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "a l'instant";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}j`;
  return `${Math.floor(seconds / 604800)}sem`;
}
