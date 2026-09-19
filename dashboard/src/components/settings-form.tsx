"use client";

import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Loader2, Check, AlertCircle } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface SettingsData {
  databaseEndpoint: string;
  chatbotEndpoint: string;
}

export function SettingsForm({
  initialSettings,
}: {
  initialSettings: SettingsData;
}) {
  const [databaseEndpoint, setDatabaseEndpoint] = useState(
    initialSettings.databaseEndpoint || ""
  );
  const [chatbotEndpoint, setChatbotEndpoint] = useState(
    initialSettings.chatbotEndpoint || ""
  );
  const [showApiKey, setShowApiKey] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  // Fallback: if server render was unauthenticated, fetch on client mount
  useEffect(() => {
    if (!initialSettings.databaseEndpoint && !initialSettings.chatbotEndpoint) {
      async function fetchSettingsOnClient() {
        try {
          const prefSnap = await getDoc(doc(db, "bank-connections", "pref"));
          if (prefSnap.exists()) {
            const data = prefSnap.data();
            if (data["database-endpoint"]) {
              setDatabaseEndpoint(data["database-endpoint"]);
            }
            if (data["chatbot-endpoint"]) {
              setChatbotEndpoint(data["chatbot-endpoint"]);
            }
          }
        } catch (err) {
          console.error("Client fetch settings error:", err);
        }
      }
      fetchSettingsOnClient();
    }
  }, [initialSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus("idle");
    setErrorMessage("");

    try {
      await setDoc(
        doc(db, "bank-connections", "pref"),
        {
          "database-endpoint": databaseEndpoint.trim(),
          "chatbot-endpoint": chatbotEndpoint.trim(),
        },
        { merge: true }
      );
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err: unknown) {
      console.error("Failed to save settings:", err);
      setSaveStatus("error");
      setErrorMessage(
        (err as { message?: string }).message ||
          "Failed to save settings. Please verify your permissions."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your endpoints and integrations to connect the dashboard to
          your infrastructure.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Data Sources */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-1">
            Data Sources
          </h2>
          <p className="text-xs text-muted-foreground mb-5">
            Connect to your bank&apos;s databases and data services.
          </p>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="database-endpoint"
                className="text-sm font-medium text-foreground block mb-1.5"
              >
                Database Endpoint
              </label>
              <input
                id="database-endpoint"
                name="database_endpoint"
                type="text"
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                value={databaseEndpoint}
                onChange={(e) => setDatabaseEndpoint(e.target.value)}
                placeholder="e.g. postgresql://db.yourbank.com:5432/accounts"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Primary database connection string for account and transaction
                data.
              </p>
            </div>
            <div>
              <label
                htmlFor="chatbot-endpoint"
                className="text-sm font-medium text-foreground block mb-1.5"
              >
                Chatbot Endpoint
              </label>
              <input
                id="chatbot-endpoint"
                name="chatbot_endpoint"
                type="text"
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                value={chatbotEndpoint}
                onChange={(e) => setChatbotEndpoint(e.target.value)}
                placeholder="e.g. https://api.yourbank.com/v1/chat"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                AI chatbot service URL for processing customer requests.
              </p>
            </div>
          </div>
        </div>

        {/* Authentication */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-1">
            Authentication
          </h2>
          <p className="text-xs text-muted-foreground mb-5">
            API keys and credentials for secure service access.
          </p>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="service-api-key"
                className="text-sm font-medium text-foreground block mb-1.5"
              >
                API Key
              </label>
              <div className="relative">
                <input
                  id="service-api-key"
                  name="service_api_key"
                  type={showApiKey ? "text" : "password"}
                  autoComplete="new-password"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-bwignore="true"
                  spellCheck={false}
                  placeholder="sk-••••••••••••••••"
                  className="w-full h-9 rounded-md border border-input bg-background pl-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Authentication key for the chatbot and AI services.
              </p>
            </div>
            <div>
              <label
                htmlFor="webhook-url"
                className="text-sm font-medium text-foreground block mb-1.5"
              >
                Webhook URL
              </label>
              <input
                id="webhook-url"
                name="webhook_url"
                type="text"
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                placeholder="e.g. https://hooks.yourbank.com/events"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Callback URL for receiving tool execution events and audit logs.
              </p>
            </div>
          </div>
        </div>

        {/* Status / Feedback */}
        {saveStatus === "error" && (
          <div className="flex items-center gap-2 p-3.5 rounded-lg border border-destructive/20 bg-destructive/10 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Save Changes Footer */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground">
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <Check className="h-4 w-4" />
                Changes saved successfully to database
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all shadow-sm disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
