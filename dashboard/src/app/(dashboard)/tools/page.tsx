import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ToolsList, type ToolItem } from "@/components/tools-list";

export const dynamic = "force-dynamic";

async function getTools(): Promise<ToolItem[]> {
  try {
    const snapshot = await getDocs(collection(db, "bank-tools"));
    return snapshot.docs.map((doc) => {
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
  } catch (error) {
    console.error("Failed to fetch bank-tools on server render:", error);
    return [];
  }
}

export default async function ToolsPage() {
  const initialTools = await getTools();

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

      <ToolsList initialTools={initialTools} />
    </div>
  );
}
