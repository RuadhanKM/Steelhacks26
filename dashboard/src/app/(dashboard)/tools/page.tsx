import { ToolCard } from "@/components/tool-card";

const tools = [
  {
    name: "Check Balance",
    description: "Verify account balance and recent transactions for accuracy.",
    defaultMode: "automate" as const,
  },
  {
    name: "Dispute Charge",
    description:
      "Initiate and manage charge disputes with transaction evidence.",
    defaultMode: "confirm" as const,
  },
  {
    name: "Move Money",
    description:
      "Transfer funds between accounts or to external destinations.",
    defaultMode: "disable" as const,
  },
  {
    name: "Pay Bills",
    description: "Schedule and process bill payments from linked accounts.",
    defaultMode: "confirm" as const,
  },
  {
    name: "Account Alerts",
    description:
      "Configure notifications for account activity and thresholds.",
    defaultMode: "automate" as const,
  },
  {
    name: "Card Controls",
    description: "Manage card settings, limits, and security preferences.",
    defaultMode: "confirm" as const,
  },
];

export default function ToolsPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Tools
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how each tool behaves when triggered by a request.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {tools.map((tool) => (
          <ToolCard
            key={tool.name}
            name={tool.name}
            description={tool.description}
            defaultMode={tool.defaultMode}
          />
        ))}
      </div>
    </div>
  );
}
