import { Link } from "react-router-dom";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-[400px]">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary-foreground"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-foreground">Autodev</h1>
          </div>

          {children}
        </div>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-border px-6 py-4 text-xs text-muted-foreground">
        <span>Autodev</span>
        <div className="flex gap-4">
          <Link to="#" className="hover:text-foreground">
            Conditions
          </Link>
          <Link to="#" className="hover:text-foreground">
            Confidentialite
          </Link>
        </div>
        <span>&copy; 2024 Autodev. Tous droits reserves.</span>
      </footer>
    </div>
  );
}
