import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useProjectColumns, useProjectMembers, useProjectLabels } from "@/hooks/use-project-data";
import type { TicketDetail } from "@/hooks/use-tickets";

interface Props {
  orgSlug: string;
  projectSlug: string;
  open: boolean;
  onClose: () => void;
  defaultColumnId?: string;
  onSuccess?: (ticketKey: string) => void;
  /** If provided, the modal is in edit mode */
  ticket?: TicketDetail | null;
}

export default function TicketCreateModal({
  orgSlug,
  projectSlug,
  open,
  onClose,
  defaultColumnId,
  onSuccess,
  ticket,
}: Props) {
  const isEdit = !!ticket;
  const queryClient = useQueryClient();
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [columnId, setColumnId] = useState("");
  const [priority, setPriority] = useState("none");
  const [assignedToId, setAssignedToId] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [complexity, setComplexity] = useState("");
  const [error, setError] = useState("");

  const { data: columns } = useProjectColumns(orgSlug, projectSlug);
  const { data: members } = useProjectMembers(orgSlug, projectSlug);
  const { data: labels } = useProjectLabels(orgSlug, projectSlug);

  // Populate form: edit mode fills from ticket, create mode resets
  useEffect(() => {
    if (!open) return;
    if (isEdit && ticket) {
      setTitle(ticket.title);
      setDescription(ticket.description ?? "");
      setAcceptanceCriteria(ticket.acceptance_criteria ?? "");
      setColumnId(typeof ticket.column === "object" ? ticket.column.id : ticket.column);
      setPriority(ticket.priority);
      setAssignedToId(ticket.assigned_to?.id ?? "");
      setSelectedLabels(ticket.labels.map((l) => l.id));
      setComplexity(ticket.estimated_complexity ?? "");
    } else {
      setTitle("");
      setDescription("");
      setAcceptanceCriteria("");
      setColumnId(defaultColumnId ?? columns?.[0]?.id ?? "");
      setPriority("none");
      setAssignedToId("");
      setSelectedLabels([]);
      setComplexity("");
    }
    setError("");
    setTimeout(() => titleRef.current?.focus(), 100);
  }, [open, ticket, isEdit, defaultColumnId, columns]);

  // Set default column if not set
  useEffect(() => {
    if (!isEdit && columns && columns.length > 0 && !columnId) {
      setColumnId(defaultColumnId ?? columns[0].id);
    }
  }, [columns, defaultColumnId, columnId, isEdit]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<{ ticket_key: string }>(`/orgs/${orgSlug}/projects/${projectSlug}/tickets/`, data),
    onSuccess: (result) => {
      invalidateAll();
      onSuccess?.(result.ticket_key);
      onClose();
    },
    onError: () => setError("Impossible de creer le ticket."),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.patch<{ ticket_key: string }>(`/orgs/${orgSlug}/projects/${projectSlug}/tickets/${ticket!.ticket_key}/`, data),
    onSuccess: (result) => {
      invalidateAll();
      onSuccess?.(result.ticket_key);
      onClose();
    },
    onError: () => setError("Impossible de modifier le ticket."),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["tickets", orgSlug, projectSlug] });
    queryClient.invalidateQueries({ queryKey: ["board", orgSlug, projectSlug] });
    if (ticket) {
      queryClient.invalidateQueries({ queryKey: ["ticket", orgSlug, projectSlug, ticket.ticket_key] });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) return;
    const payload: Record<string, unknown> = {
      title: title.trim(),
      column: columnId,
      priority,
      description: description || "",
      acceptance_criteria: acceptanceCriteria || "",
      assigned_to_id: assignedToId || null,
      label_ids: selectedLabels,
      estimated_complexity: complexity || null,
    };
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && title.trim()) handleSubmit();
  };

  const toggleLabel = (id: string) => {
    setSelectedLabels((prev) => prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]);
  };

  if (!open) return null;

  const selectClass = "h-10 w-full rounded-lg border border-foreground/10 bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
  const labelClass = "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[680px] rounded-xl border border-foreground/5 bg-surface-elevated shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-foreground/5 px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? `Modifier ${ticket!.ticket_key}` : "Nouveau ticket"}
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>}

          <input ref={titleRef} type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du ticket" maxLength={500} required className="h-12 w-full rounded-lg border border-foreground/10 bg-surface px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Colonne</label>
              <select value={columnId} onChange={(e) => setColumnId(e.target.value)} className={selectClass}>
                {columns?.map((col) => <option key={col.id} value={col.id}>{col.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Priorite</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selectClass}>
                <option value="none">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ajouter une description..." rows={5} className="w-full resize-y rounded-lg border border-foreground/10 bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            <p className="text-[10px] text-muted-foreground">Markdown supporte</p>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Criteres d'acceptation</label>
            <textarea value={acceptanceCriteria} onChange={(e) => setAcceptanceCriteria(e.target.value)} placeholder="Liste des criteres..." rows={3} className="w-full resize-y rounded-lg border border-foreground/10 bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Assigne a</label>
              <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className={selectClass}>
                <option value="">Non assigne</option>
                {members?.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.full_name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Labels</label>
              <div className="flex min-h-[40px] flex-wrap items-center gap-1 rounded-lg border border-foreground/10 bg-surface px-2 py-1.5">
                {selectedLabels.map((id) => {
                  const label = labels?.find((l) => l.id === id);
                  if (!label) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: label.color + "25", color: label.color }}>
                      {label.name}
                      <button type="button" onClick={() => toggleLabel(id)} className="hover:opacity-70">
                        <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                      </button>
                    </span>
                  );
                })}
                {labels && labels.filter((l) => !selectedLabels.includes(l.id)).length > 0 && (
                  <select value="" onChange={(e) => { if (e.target.value) toggleLabel(e.target.value); }} className="h-6 border-0 bg-transparent text-[10px] text-muted-foreground outline-none">
                    <option value="">+ Ajouter</option>
                    {labels.filter((l) => !selectedLabels.includes(l.id)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="w-1/2 space-y-1.5">
            <label className={labelClass}>Complexite</label>
            <select value={complexity} onChange={(e) => setComplexity(e.target.value)} className={selectClass}>
              <option value="">—</option><option value="xs">XS</option><option value="s">S</option><option value="m">M</option><option value="l">L</option><option value="xl">XL</option>
            </select>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-foreground/5 px-6 py-3">
          <p className="text-[11px] text-muted-foreground">
            <kbd className="rounded border border-foreground/10 px-1 py-0.5 text-[10px]">Ctrl</kbd>{" + "}<kbd className="rounded border border-foreground/10 px-1 py-0.5 text-[10px]">Enter</kbd>
            {isEdit ? " pour modifier" : " pour creer le ticket"}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-9 rounded-lg border border-foreground/10 px-4 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
            <button onClick={() => handleSubmit()} disabled={isPending || !title.trim()} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {isPending ? (isEdit ? "Modification..." : "Creation...") : (isEdit ? "Modifier le ticket" : "Creer le ticket")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
