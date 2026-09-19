"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText } from "lucide-react";

interface ToolCardProps {
  name: string;
  description: string;
  defaultMode?: "automate" | "confirm" | "disable";
}

const modeConfig = {
  automate: {
    label: "Automate",
    dotColor: "bg-emerald-500",
  },
  confirm: {
    label: "Confirm",
    dotColor: "bg-amber-500",
  },
  disable: {
    label: "Disable",
    dotColor: "bg-red-500",
  },
};

export function ToolCard({
  name,
  description,
  defaultMode = "confirm",
}: ToolCardProps) {
  const [mode, setMode] = useState<"automate" | "confirm" | "disable">(
    defaultMode
  );
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rules, setRules] = useState("");
  const [savedRules, setSavedRules] = useState("");

  const currentMode = modeConfig[mode];

  const handleConfirmRules = () => {
    setSavedRules(rules);
    setRulesOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-5 rounded-lg border border-border bg-card px-6 py-5 shadow-sm">
        {/* Status dot */}
        <span
          className={`shrink-0 h-3 w-3 rounded-full ${currentMode.dotColor} transition-colors duration-300`}
          style={{
            boxShadow: `0 0 6px ${mode === "automate" ? "rgba(16,185,129,0.35)" : mode === "confirm" ? "rgba(245,158,11,0.35)" : "rgba(239,68,68,0.35)"}`,
          }}
        />

        {/* Tool Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground text-base leading-tight">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {description}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <Select
            value={mode}
            onValueChange={(v) =>
              setMode(v as "automate" | "confirm" | "disable")
            }
          >
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="automate">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Automate
                </span>
              </SelectItem>
              <SelectItem value="confirm">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Confirm
                </span>
              </SelectItem>
              <SelectItem value="disable">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Disable
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRules(savedRules);
              setRulesOpen(true);
            }}
            className="h-9 gap-2 text-sm"
          >
            <FileText className="h-3.5 w-3.5" />
            Rules
            {savedRules && (
              <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </Button>
        </div>
      </div>

      {/* Rules Modal */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rules for {name}</DialogTitle>
            <DialogDescription>
              Define custom rules for how this tool should behave. These rules
              will be applied when the tool is triggered.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder={`e.g. Item has been charged three times\nPrice of item is over $10`}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              className="min-h-[150px] resize-none text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRulesOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRules}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
