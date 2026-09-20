"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wrench, Settings, Gavel } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Tools",
    href: "/tools",
    icon: <Wrench className="h-4 w-4" />,
  },
  {
    label: "Disputes",
    href: "/disputes",
    icon: <Gavel className="h-4 w-4" />,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: <Settings className="h-4 w-4" />,
  },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 p-4 space-y-1">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "text-muted-foreground hover:text-primary hover:bg-accent"
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
