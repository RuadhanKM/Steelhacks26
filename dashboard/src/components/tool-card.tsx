"use client";

import { useState, useRef } from "react";
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
import { FileText, Loader2, Pencil, Check } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ToolCardProps {
  id?: string;
  name: string;
  description?: string;
  automationLevel?: number; // 0: automate, 1: confirm, 2: disabled
  rules?: string;
  defaultMode?: "automate" | "confirm" | "disable";
}

export function levelToMode(
  level: number | undefined
): "automate" | "confirm" | "disable" {
  if (level === 0) return "automate";
  if (level === 2) return "disable";
  return "confirm";
}

export function modeToLevel(mode: "automate" | "confirm" | "disable"): number {
  if (mode === "automate") return 0;
  if (mode === "disable") return 2;
  return 1;
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
  id,
  name,
  description: initialDescription = "",
  automationLevel,
  rules: initialRules = "",
  defaultMode = "confirm",
}: ToolCardProps) {
  const initialMode =
    typeof automationLevel === "number"
      ? levelToMode(automationLevel)
      : defaultMode;

  const [mode, setMode] =
    useState<"automate" | "confirm" | "disable">(initialMode);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rules, setRules] = useState(initialRules);
  const [savedRules, setSavedRules] = useState(initialRules);
  const [saving, setSaving] = useState(false);

  // Inline description editing state
  const [description, setDescription] = useState(initialDescription);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState(initialDescription);
  const [savingDescription, setSavingDescription] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const currentMode = modeConfig[mode];

  const handleModeChange = async (
    newMode: "automate" | "confirm" | "disable" | null
  ) => {
    if (!newMode) return;
    setMode(newMode);
    if (!id) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, "bank-tools", id), {
        "automation-level": modeToLevel(newMode),
      });
    } catch (error) {
      console.error(`Failed to update automation level for ${name}:`, error);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRules = async () => {
    setSavedRules(rules);
    setRulesOpen(false);
    if (!id) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, "bank-tools", id), {
        rules: rules,
      });
    } catch (error) {
      console.error(`Failed to update rules for ${name}:`, error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDescription = async () => {
    const trimmed = descriptionInput.trim();
    setDescription(trimmed);
    setIsEditingDescription(false);

    if (id && trimmed !== description) {
      setSavingDescription(true);
      try {
        await updateDoc(doc(db, "bank-tools", id), {
          description: trimmed,
        });
      } catch (error) {
        console.error(`Failed to update description for ${name}:`, error);
        setDescription(description); // Rollback on failure
      } finally {
        setSavingDescription(false);
      }
    }
  };

  return (
    <>
      <div className="flex items-center gap-5 rounded-lg border border-border bg-card px-6 py-5 shadow-sm">
        {/* Status dot */}
        <span
          className={`shrink-0 h-3 w-3 rounded-full ${currentMode.dotColor} transition-colors duration-300`}
          style={{
            boxShadow: `0 0 6px ${
              mode === "automate"
                ? "rgba(16,185,129,0.35)"
                : mode === "confirm"
                ? "rgba(245,158,11,0.35)"
                : "rgba(239,68,68,0.35)"
            }`,
          }}
        />

        {/* Tool Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground text-base leading-tight">
              {name}
            </h3>
            {(saving || savingDescription) && (
              <span className="flex items-center text-xs text-muted-foreground gap-1 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-[11px]">Saving...</span>
              </span>
            )}
          </div>

          {isEditingDescription ? (
            <div className="relative mt-2 w-full">
              <textarea
                ref={(el) => el?.focus()}
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveDescription();
                  } else if (e.key === "Escape") {
                    setIsEditingDescription(false);
                    setDescriptionInput(description);
                  }
                }}
                onBlur={(e) => {
                  if (
                    e.relatedTarget &&
                    confirmButtonRef.current?.contains(e.relatedTarget as Node)
                  ) {
                    return;
                  }
                  setIsEditingDescription(false);
                  setDescriptionInput(description);
                }}
                rows={2}
                className="w-full text-xs rounded-md border border-input bg-background pl-2.5 pr-8 py-1.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed"
                placeholder="Enter description and press Enter..."
                disabled={savingDescription}
              />
              <button
                ref={confirmButtonRef}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleSaveDescription}
                disabled={savingDescription}
                className="absolute right-2 bottom-2.5 inline-flex items-center justify-center h-5 w-5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="Confirm (Enter)"
              >
                {savingDescription ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDescriptionInput(description);
                setIsEditingDescription(true);
              }}
              className="group/desc flex items-center gap-2 mt-0.5 text-left rounded-md px-1.5 py-0.5 -ml-1.5 hover:bg-accent/80 transition-colors cursor-pointer w-fit max-w-full"
              title="Click to edit description"
            >
              <span
                className="text-sm text-muted-foreground group-hover/desc:text-foreground transition-colors truncate"
                title={description}
              >
                {description || (
                  <span className="italic text-muted-foreground/60">
                    No description added yet
                  </span>
                )}
              </span>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground/40 group-hover/desc:text-primary transition-colors shrink-0" />
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <Select value={mode} onValueChange={handleModeChange}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue className="capitalize">
                {(val: "automate" | "confirm" | "disable" | null) =>
                  val && modeConfig[val] ? modeConfig[val].label : val
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-[150px]">
              <SelectItem value="automate">
                <span className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  Automate
                </span>
              </SelectItem>
              <SelectItem value="confirm">
                <span className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  Confirm
                </span>
              </SelectItem>
              <SelectItem value="disable">
                <span className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
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
              className="min-h-[150px] resize-none text-sm font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRulesOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRules} disabled={saving}>
              {saving ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
