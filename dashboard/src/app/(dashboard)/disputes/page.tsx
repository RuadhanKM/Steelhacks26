import { DisputesQueue } from "@/components/disputes-queue";

export default function DisputesPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Disputes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cases a customer opened and a reviewer has to decide. Approving posts a
          reversal; rejecting leaves the charges as they are.
        </p>
      </div>

      <DisputesQueue />
    </div>
  );
}
