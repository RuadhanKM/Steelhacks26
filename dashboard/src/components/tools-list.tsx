"use client";

import React, { useState, useEffect } from "react";
import { ToolCard } from "@/components/tool-card";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  automationLevel: number;
  rules: string;
}

export function ToolsList({ initialTools }: { initialTools: ToolItem[] }) {
  const [tools, setTools] = useState<ToolItem[]>(initialTools);
  const [loading, setLoading] = useState(initialTools.length === 0);

  useEffect(() => {
    // If tools were not loaded during server render, fetch one-time on mount
    if (initialTools.length === 0) {
      async function fetchTools() {
        try {
          const snapshot = await getDocs(collection(db, "bank-tools"));
          const items: ToolItem[] = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || "Unnamed Tool",
              description: data.description || "",
              automationLevel:
                typeof data["automation-level"] === "number"
                  ? data["automation-level"]
                  : 1,
              rules: data.rules || "",
            };
          });
          setTools(items);
        } catch (error) {
          console.error("Error fetching bank-tools on client:", error);
        } finally {
          setLoading(false);
        }
      }
      fetchTools();
    }
  }, [initialTools]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-xs">Loading tools from database...</span>
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No tools found in the database.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tools.map((tool) => (
        <ToolCard
          key={tool.id}
          id={tool.id}
          name={tool.name}
          description={tool.description}
          automationLevel={tool.automationLevel}
          rules={tool.rules}
        />
      ))}
    </div>
  );
}
