export default function SettingsPage() {
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

      <div className="space-y-6">
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
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Database Endpoint
              </label>
              <input
                type="text"
                placeholder="e.g. postgresql://db.yourbank.com:5432/accounts"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Primary database connection string for account and transaction
                data.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Chatbot Endpoint
              </label>
              <input
                type="text"
                placeholder="e.g. https://api.yourbank.com/v1/chat"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
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
              <label className="text-sm font-medium text-foreground block mb-1.5">
                API Key
              </label>
              <input
                type="password"
                placeholder="sk-••••••••••••••••"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Authentication key for the chatbot and AI services.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Webhook URL
              </label>
              <input
                type="text"
                placeholder="e.g. https://hooks.yourbank.com/events"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Callback URL for receiving tool execution events and audit logs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
