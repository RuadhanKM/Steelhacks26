"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth-context";
import { Gavel, LogOut, Loader2, User } from "lucide-react";

function DisputesHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setLoggingOut(true);
      await logout();
      router.replace("/login");
    } catch (error) {
      console.error("Failed to sign out", error);
      setLoggingOut(false);
    }
  };

  const email = user?.email || "Reviewer";

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur px-6 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
          <Gavel className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-foreground">
              Dispute Review
            </span>
            <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
              Reviewer Portal
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Standalone Review Queue
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground border-r border-border pr-4">
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="font-medium text-foreground max-w-[200px] truncate" title={email}>
            {email}
          </span>
        </div>

        <button
          onClick={handleSignOut}
          disabled={loggingOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all cursor-pointer disabled:opacity-60"
          title="Sign Out"
        >
          {loggingOut ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="h-3.5 w-3.5" />
          )}
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}

export default function DisputesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex flex-col h-full bg-background">
        <DisputesHeader />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}
