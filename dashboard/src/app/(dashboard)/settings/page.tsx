import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SettingsForm, type SettingsData } from "@/components/settings-form";

export const dynamic = "force-dynamic";

async function getSettings(): Promise<SettingsData> {
  try {
    const prefSnap = await getDoc(doc(db, "bank-connections", "pref"));
    if (prefSnap.exists()) {
      const data = prefSnap.data();
      return {
        databaseEndpoint: data["database-endpoint"] || "",
        chatbotEndpoint: data["chatbot-endpoint"] || "",
      };
    }
  } catch (error) {
    console.error("Failed to fetch settings on server render:", error);
  }
  return {
    databaseEndpoint: "",
    chatbotEndpoint: "",
  };
}

export default async function SettingsPage() {
  const initialSettings = await getSettings();

  return <SettingsForm initialSettings={initialSettings} />;
}
