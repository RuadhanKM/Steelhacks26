import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { DashboardNav } from "@/components/dashboard-nav";
import { AuthGuard } from "@/components/auth-guard";
import { SidebarUser } from "@/components/sidebar-user";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-full bg-background">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-card flex flex-col">
          <div className="p-6 border-b border-border">
            <Link href="/tools" className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-sm shadow-primary/20">
                <LayoutDashboard className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg tracking-tight">
                Dashboard
              </span>
            </Link>
          </div>

          <DashboardNav />

          <SidebarUser />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}
