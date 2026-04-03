import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgStore } from "@/stores/org-store";
import { useOrgs } from "@/hooks/use-orgs";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import OnboardingPage from "@/pages/onboarding/OnboardingPage";
import BoardPage from "@/pages/board/BoardPage";
import TicketsPage from "@/pages/tickets/TicketsPage";
import ProjectSettingsPage from "@/pages/settings/ProjectSettingsPage";
import OrgSettingsPage from "@/pages/settings/OrgSettingsPage";
import AgentsPage from "@/pages/agents/AgentsPage";
import PlaceholderPage from "@/pages/PlaceholderPage";

function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const setCurrentOrg = useOrgStore((s) => s.setCurrentOrg);
  const { data: orgs, isLoading } = useOrgs();

  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;

  // Already have an org in store (from localStorage)
  if (currentOrg?.slug) return <Navigate to={`/${currentOrg.slug}`} replace />;

  // Wait for API to load orgs
  if (isLoading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Chargement...</div>;

  // Use first org from API
  if (orgs && orgs.length > 0) {
    setCurrentOrg(orgs[0]);
    return <Navigate to={`/${orgs[0].slug}`} replace />;
  }

  // No org at all — go to onboarding
  return <Navigate to="/onboarding" replace />;
}

function FallbackRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  return <Navigate to="/" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public auth routes (no layout) */}
      <Route path="/auth/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/auth/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

      {/* Protected routes with AppLayout */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {/* Profile */}
        <Route path="/settings/profile" element={<PlaceholderPage title="Mon profil" description="Gerez vos informations personnelles et preferences" />} />

        {/* Org dashboard */}
        <Route path="/:orgSlug" element={<PlaceholderPage title="Dashboard" description="Vue d'ensemble de votre organisation" />} />

        {/* Org notifications */}
        <Route path="/:orgSlug/notifications" element={<PlaceholderPage title="Notifications" description="Vos notifications recentes" />} />

        {/* Org settings */}
        <Route path="/:orgSlug/settings" element={<OrgSettingsPage />} />
        <Route path="/:orgSlug/settings/:tab" element={<OrgSettingsPage />} />

        {/* New project */}
        <Route path="/:orgSlug/projects/new" element={<PlaceholderPage title="Nouveau projet" description="Creez un nouveau projet pour votre equipe" />} />

        {/* Project routes */}
        <Route path="/:orgSlug/:projectSlug/board" element={<BoardPage />} />
        <Route path="/:orgSlug/:projectSlug/tickets" element={<TicketsPage />} />
        <Route path="/:orgSlug/:projectSlug/agents" element={<AgentsPage />} />
        <Route path="/:orgSlug/:projectSlug/agents/:agentType" element={<AgentsPage />} />
        <Route path="/:orgSlug/:projectSlug/activity" element={<PlaceholderPage title="Activite" description="Historique des actions sur le projet" />} />
        <Route path="/:orgSlug/:projectSlug/settings" element={<ProjectSettingsPage />} />
        <Route path="/:orgSlug/:projectSlug/settings/:tab" element={<ProjectSettingsPage />} />
      </Route>

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Fallback */}
      <Route path="*" element={<FallbackRedirect />} />
    </Routes>
  );
}
