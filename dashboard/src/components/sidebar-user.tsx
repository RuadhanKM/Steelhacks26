"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LogOut, Loader2, User as UserIcon } from "lucide-react";

export function SidebarUser() {
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

  const email = user?.email || "Authenticated User";
  const initial = email.charAt(0).toUpperCase();

  return (
    <div className="mt-auto p-4 border-t border-border space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs border border-primary/20">
          {initial !== "A" && initial ? initial : <UserIcon className="h-4 w-4 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate" title={email}>
            {email}
          </p>
          <p className="text-[11px] text-muted-foreground">Signed in</p>
        </div>
      </div>

      <button
        onClick={handleSignOut}
        disabled={loggingOut}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all duration-150 cursor-pointer disabled:opacity-60"
        title="Sign Out"
      >
        {loggingOut ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Signing out...</span>
          </>
        ) : (
          <>
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </>
        )}
      </button>
    </div>
  );
}
