import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgStore } from "@/stores/org-store";
import { useThemeStore } from "@/stores/theme-store";
import { useCurrentRoute } from "@/hooks/use-current-route";
import { useOrgs } from "@/hooks/use-orgs";

export default function Header() {
  const route = useCurrentRoute();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const currentProject = useOrgStore((s) => s.currentProject);
  const orgSlug = currentOrg?.slug;

  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-border bg-surface px-4">
      {/* Left: Logo + Org name + Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link to={orgSlug ? `/${orgSlug}` : "/"} className="text-sm font-bold text-foreground tracking-tight">
          Autodev
        </Link>

        {currentOrg && (
          <>
            <span className="text-foreground/15">|</span>
            <OrgSwitcher />
          </>
        )}

        {/* Breadcrumb */}
        <nav className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
          {currentProject && (
            <>
              <span className="text-foreground/20">&rsaquo;</span>
              <Link to={`/${orgSlug}/${currentProject.slug}/board`} className="hover:text-foreground">
                {currentProject.name}
              </Link>
            </>
          )}
          {route.section && route.section !== "dashboard" && (
            <>
              <span className="text-foreground/20">&rsaquo;</span>
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
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium text-foreground hover:bg-foreground/5"
      >
        {currentOrg?.name ?? "Organisation"}
        <svg className="size-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 rounded-lg border border-foreground/10 bg-surface-elevated py-1 shadow-xl">
          {(orgs ?? []).map((org) => (
            <button
              key={org.id}
              onClick={() => { setCurrentOrg(org); navigate(`/${org.slug}`); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-foreground/5 ${
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
          <div className="my-1 h-px bg-foreground/5" />
          <button
            onClick={() => { navigate("/onboarding"); setOpen(false); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
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
      className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
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
    <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground" title="Aide">
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
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

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

  const cycleTheme = () => {
    const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
    setTheme(next);
  };

  const themeLabel = theme === "dark" ? "Sombre" : theme === "light" ? "Clair" : "Systeme";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary hover:bg-primary/30"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-surface-elevated py-1 shadow-xl">
          <button onClick={() => { navigate("/settings/profile"); setOpen(false); }} className="flex w-full items-center px-3 py-2 text-sm text-foreground hover:bg-foreground/5">
            Mon profil
          </button>
          <button onClick={() => { navigate("/settings/profile"); setOpen(false); }} className="flex w-full items-center px-3 py-2 text-sm text-foreground hover:bg-foreground/5">
            Preferences
          </button>
          <div className="my-1 h-px bg-foreground/5" />
          <button
            onClick={cycleTheme}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-foreground/5"
          >
            {theme === "dark" && <MoonIcon />}
            {theme === "light" && <SunIcon />}
            {theme === "system" && <MonitorIcon />}
            <span>Theme : {themeLabel}</span>
          </button>
          <div className="my-1 h-px bg-foreground/5" />
          <button onClick={() => { logout(); navigate("/auth/login"); setOpen(false); }} className="flex w-full items-center px-3 py-2 text-sm text-destructive hover:bg-foreground/5">
            Deconnexion
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Theme Icons ── */

function SunIcon() {
  return (
    <svg className="size-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="size-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg className="size-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" />
    </svg>
  );
}
