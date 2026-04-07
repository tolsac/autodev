import type { Project } from "@/types";

export default function BoardToolbar({
  project,
  searchQuery,
  onSearchChange,
}: {
  project: Project;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  return (
    <div className="border-b border-foreground/5 px-6 py-4">
      {/* Project name */}
      <h1 className="text-lg font-semibold text-foreground">{project.name}</h1>

      {/* Filters row */}
      <div className="mt-3 flex items-center gap-2">
        <FilterButton label="Assignee" icon={<UserIcon />} />
        <FilterButton label="Labels" icon={<TagIcon />} />
        <FilterButton label="Priority" icon={<FlagIcon />} />

        <div className="ml-auto relative">
          <svg className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search board..."
            className="h-8 w-52 rounded-lg border border-foreground/10 bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
    </div>
  );
}

function FilterButton({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <button className="flex h-8 items-center gap-1.5 rounded-lg border border-foreground/10 bg-surface px-2.5 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground">
      {icon}
      {label}
      <svg className="size-3 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

function UserIcon() {
  return <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}

function TagIcon() {
  return <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></svg>;
}

function FlagIcon() {
  return <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>;
}
