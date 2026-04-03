import { useState, useCallback, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Project } from "@/types";
import { useTicketsList, type TicketFilters, type TicketListItem } from "@/hooks/use-tickets";
import PriorityIndicator from "@/components/tickets/PriorityIndicator";
import AgentStatusBadges from "@/components/tickets/AgentStatusBadges";
import TicketDetailModal from "@/components/tickets/TicketDetailModal";
import TicketCreateModal from "@/components/tickets/TicketCreateModal";

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "a l'instant";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}j`;
  return `${Math.floor(seconds / 604800)}sem`;
}

export default function TicketsPage() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");

  // Filters from URL
  const filters: TicketFilters = {
    column: searchParams.get("column") ?? undefined,
    assigned_to: searchParams.get("assigned_to") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    label: searchParams.get("label") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    ordering: searchParams.get("ordering") ?? "-created_at",
  };

  // Ticket modal from URL
  const selectedTicketKey = searchParams.get("ticket");

  const { data: project } = useQuery<Project>({
    queryKey: ["project", orgSlug, projectSlug],
    queryFn: () => api.get<Project>(`/orgs/${orgSlug}/projects/${projectSlug}/`),
    enabled: !!orgSlug && !!projectSlug,
  });

  const { data, isLoading } = useTicketsList(orgSlug!, projectSlug!, filters);

  const setFilter = useCallback((key: string, value: string | undefined) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }, [setSearchParams]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setFilter("search", searchInput || undefined), 300);
    return () => clearTimeout(t);
  }, [searchInput, setFilter]);

  // Keyboard shortcut: C to open create modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
        if (!isInput && !createModalOpen && !selectedTicketKey) {
          setCreateModalOpen(true);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createModalOpen, selectedTicketKey]);

  const openTicket = (key: string) => {
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set("ticket", key); return n; });
  };
  const closeTicket = () => {
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete("ticket"); return n; });
  };

  const setOrdering = (field: string) => {
    const current = filters.ordering;
    if (current === field) setFilter("ordering", `-${field}`);
    else if (current === `-${field}`) setFilter("ordering", undefined);
    else setFilter("ordering", field);
  };

  const orderIcon = (field: string) => {
    if (filters.ordering === field) return " ↑";
    if (filters.ordering === `-${field}`) return " ↓";
    return "";
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground">Tickets</h1>
          {project && <span className="text-sm text-muted-foreground">— {project.name}</span>}
          {data && <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">{data.count}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors ${filtersOpen ? "border-primary/30 text-primary" : "border-white/10 text-[#8b8b9e] hover:text-foreground"}`}
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            Filtres
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            title="Nouveau ticket (C)"
            className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Ticket
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {filtersOpen && (
        <div className="flex items-center gap-2 border-b border-white/5 px-6 py-3">
          <select value={filters.priority ?? ""} onChange={(e) => setFilter("priority", e.target.value || undefined)} className="h-8 rounded-lg border border-white/10 bg-[#0c0c14] px-2 text-xs text-foreground">
            <option value="">Priorite</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">None</option>
          </select>
          <div className="relative ml-auto">
            <svg className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#8b8b9e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input
              type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher..."
              className="h-8 w-52 rounded-lg border border-white/10 bg-[#0c0c14] pl-7 pr-3 text-xs text-foreground placeholder:text-[#8b8b9e] focus:border-primary focus:outline-none"
            />
          </div>
          <button onClick={() => { setSearchParams(new URLSearchParams()); setSearchInput(""); }} className="text-xs text-[#8b8b9e] hover:text-foreground">
            Reinitialiser
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">Chargement...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[#0c0c14]">
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="w-20 cursor-pointer px-4 py-3 hover:text-foreground" onClick={() => setOrdering("ticket_key")}>Key{orderIcon("ticket_key")}</th>
                <th className="px-4 py-3">Titre</th>
                <th className="w-28 px-4 py-3">Colonne</th>
                <th className="w-16 cursor-pointer px-4 py-3 hover:text-foreground" onClick={() => setOrdering("priority")}>Prio{orderIcon("priority")}</th>
                <th className="w-28 px-4 py-3">Agents</th>
                <th className="w-20 px-4 py-3">Assigne</th>
                <th className="w-24 cursor-pointer px-4 py-3 hover:text-foreground" onClick={() => setOrdering("updated_at")}>Maj{orderIcon("updated_at")}</th>
              </tr>
            </thead>
            <tbody>
              {data?.results.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} onClick={() => openTicket(ticket.ticket_key)} />
              ))}
              {data?.results.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Aucun ticket trouve</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail modal */}
      <TicketDetailModal orgSlug={orgSlug!} projectSlug={projectSlug!} ticketKey={selectedTicketKey} onClose={closeTicket} />

      {/* Create modal */}
      <TicketCreateModal
        orgSlug={orgSlug!}
        projectSlug={projectSlug!}
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={(ticketKey: string) => openTicket(ticketKey)}
      />
    </div>
  );
}

function TicketRow({ ticket, onClick }: { ticket: TicketListItem; onClick: () => void }) {
  return (
    <tr onClick={onClick} className="cursor-pointer border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]">
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{ticket.ticket_key}</td>
      <td className="px-4 py-3">
        <div className="truncate font-medium text-foreground">{ticket.title}</div>
        {ticket.labels.length > 0 && (
          <div className="mt-1 flex gap-1">
            {ticket.labels.map((l) => (
              <span key={l.id} className="rounded px-1 py-0.5 text-[10px] font-medium" style={{ backgroundColor: l.color + "20", color: l.color }}>
                {l.name}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">{ticket.column_name}</span>
      </td>
      <td className="px-4 py-3"><PriorityIndicator priority={ticket.priority} /></td>
      <td className="px-4 py-3">
        <AgentStatusBadges statuses={{
          challenge_status: ticket.challenge_status, plan_status: ticket.plan_status,
          code_status: ticket.code_status, review_status: ticket.review_status,
          fix_status: ticket.fix_status,
        }} />
      </td>
      <td className="px-4 py-3">
        {ticket.assigned_to ? (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-medium text-primary" title={ticket.assigned_to.full_name}>
            {ticket.assigned_to.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground" title={new Date(ticket.updated_at).toLocaleString("fr-FR")}>
        {timeAgo(ticket.updated_at)}
      </td>
    </tr>
  );
}
