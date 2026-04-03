import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgStore } from "@/stores/org-store";
import { useCurrentRoute } from "@/hooks/use-current-route";
import { useOrgs } from "@/hooks/use-orgs";

export default function Header() {
  const route = useCurrentRoute();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const currentProject = useOrgStore((s) => s.currentProject);
  const orgSlug = currentOrg?.slug;

  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-white/5 bg-[#0c0c14] px-4">
      {/* Left: Logo + Org name + Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link to={orgSlug ? `/${orgSlug}` : "/"} className="text-sm font-bold text-foreground tracking-tight">
          Autodev
        </Link>

        {currentOrg && (
          <>
            <span className="text-white/15">|</span>
            <OrgSwitcher />
          </>
        )}

        {/* Breadcrumb */}
        <nav className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
          {currentProject && (
            <>
              <span className="text-white/20">&rsaquo;</span>
              <Link to={`/${orgSlug}/${currentProject.slug}/board`} className="hover:text-foreground">
                {currentProject.name}
              </Link>
            </>
          )}
          {route.section && route.section !== "dashboard" && (
            <>
              <span className="text-white/20">&rsaquo;</span>
              <span className="text-foreground">
                {route.section === "board" && "Board"}
                {route.section === "tickets" && "Tickets"}
                {route.section === "ticket-detail" && route.ticketKey}
                {route.section === "activity" && "Activity"}
                {route.section === "project-settings" && "Settings"}
                {route.section === "org-settings" && "Settings"}
                {route.section === "members" && "Members"}
                {route.section === "scm" && "Git"}
                {route.section === "billing" && "Billing"}
                {route.section === "notifications" && "Notifications"}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Right: Notifications, Help, Avatar */}
      <div className="flex items-center gap-2">
        <NotificationButton orgSlug={orgSlug} />
        <HelpButton />
        <UserMenu />
      </div>
    </header>
  );
}

/* ── OrgSwitcher ── */

function OrgSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const setCurrentOrg = useOrgStore((s) => s.setCurrentOrg);
  const navigate = useNavigate();
  const { data: orgs } = useOrgs();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium text-foreground hover:bg-white/5"
      >
        {currentOrg?.name ?? "Organisation"}
        <svg className="size-3 text-[#8b8b9e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 rounded-lg border border-white/10 bg-[#13131d] py-1 shadow-xl">
          {(orgs ?? []).map((org) => (
            <button
              key={org.id}
              onClick={() => { setCurrentOrg(org); navigate(`/${org.slug}`); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 ${
                currentOrg?.id === org.id ? "text-primary" : "text-foreground"
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 text-[10px] font-bold text-primary">
                {org.name[0]}
              </span>
              {org.name}
              {currentOrg?.id === org.id && <span className="ml-auto text-xs text-primary">&#10003;</span>}
            </button>
          ))}
          <div className="my-1 h-px bg-white/5" />
          <button
            onClick={() => { navigate("/onboarding"); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#8b8b9e] hover:bg-white/5 hover:text-foreground"
          >
            Creer une organisation
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Notification Button ── */

function NotificationButton({ orgSlug }: { orgSlug: string | null | undefined }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => orgSlug && navigate(`/${orgSlug}/notifications`)}
      className="relative flex h-8 w-8 items-center justify-center rounded-md text-[#8b8b9e] hover:bg-white/5 hover:text-foreground"
    >
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
    </button>
  );
}

/* ── Help Button ── */

function HelpButton() {
  return (
    <button className="flex h-8 w-8 items-center justify-center rounded-md text-[#8b8b9e] hover:bg-white/5 hover:text-foreground" title="Aide">
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
      </svg>
    </button>
  );
}

/* ── User Menu ── */

function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = (user?.full_name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary hover:bg-primary/30"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-white/10 bg-[#13131d] py-1 shadow-xl">
          <button onClick={() => { navigate("/settings/profile"); setOpen(false); }} className="flex w-full items-center px-3 py-2 text-sm text-foreground hover:bg-white/5">
            Mon profil
          </button>
          <button onClick={() => { navigate("/settings/profile"); setOpen(false); }} className="flex w-full items-center px-3 py-2 text-sm text-foreground hover:bg-white/5">
            Preferences
          </button>
          <div className="my-1 h-px bg-white/5" />
          <button onClick={() => { logout(); navigate("/auth/login"); setOpen(false); }} className="flex w-full items-center px-3 py-2 text-sm text-destructive hover:bg-white/5">
            Deconnexion
          </button>
        </div>
      )}
    </div>
  );
}
