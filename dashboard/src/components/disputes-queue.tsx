"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  approveDispute,
  claimDispute,
  formatAmount,
  formatDateTime,
  getPendingDisputes,
  getSessionInfo,
  rejectDispute,
  REASON_LABELS,
  type DisputeCase,
  type SessionInfo,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Decision = "approve" | "reject";

function StatusBadge({ status }: { status: DisputeCase["status"] }) {
  const styles: Record<string, string> = {
    submitted: "bg-muted text-muted-foreground",
    under_review: "bg-primary/10 text-primary",
    resolved: "bg-emerald-500/10 text-emerald-600",
    rejected: "bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = {
    submitted: "Submitted",
    under_review: "Under review",
    resolved: "Resolved",
    rejected: "Not approved",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        styles[status] ?? styles.submitted,
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}

function CaseCard({
  dispute,
  onDecided,
}: {
  dispute: DisputeCase;
  onDecided: (updated: DisputeCase, decision: Decision) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<Decision | "claim" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: Decision) => {
    setBusy(decision);
    setError(null);
    try {
      // Claiming first records who reviewed it, so two reviewers do not both
      // work the same case.
      if (dispute.status === "submitted") {
        await claimDispute(dispute.id);
      }
      const updated =
        decision === "approve"
          ? await approveDispute(dispute.id, note)
          : await rejectDispute(dispute.id, note);
      onDecided(updated, decision);
    } catch (decideError) {
      setError(
        decideError instanceof ApiError
          ? decideError.message
          : "Could not record that decision. Try again.",
      );
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {dispute.merchant ?? "Unknown merchant"}
            </h3>
            <StatusBadge status={dispute.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {REASON_LABELS[dispute.reason ?? ""] ?? dispute.reason ?? "—"} ·{" "}
            {dispute.transactionIds.length} charge
            {dispute.transactionIds.length === 1 ? "" : "s"} · opened{" "}
            {formatDateTime(dispute.createdAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-foreground">
            {formatAmount(dispute.claimedAmountCents)}
          </p>
          <p className="text-xs text-muted-foreground">to credit</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-4 text-xs">
        <div>
          <dt className="text-muted-foreground">Customer</dt>
          <dd className="mt-0.5 font-mono text-foreground">{dispute.userId}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Account</dt>
          <dd className="mt-0.5 font-mono text-foreground">
            {dispute.accountId ?? "—"}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Charges</dt>
          <dd className="mt-0.5 font-mono text-foreground">
            {dispute.transactionIds.join(", ")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Contacted merchant</dt>
          <dd className="mt-0.5 text-foreground">
            {dispute.contactedMerchant === true
              ? "Yes"
              : dispute.contactedMerchant === false
                ? "No"
                : "Not said"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Policy version</dt>
          <dd className="mt-0.5 font-mono text-foreground">
            {dispute.policyConfigVersion ?? "—"}
          </dd>
        </div>
        {dispute.note && (
          <div className="col-span-2">
            <dt className="text-muted-foreground">Customer note</dt>
            <dd className="mt-0.5 text-foreground italic">
              &ldquo;{dispute.note}&rdquo;
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4 border-t border-border pt-4">
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Reason for your decision (optional, shown to the customer)"
          className="min-h-16 text-sm"
          disabled={busy !== null}
        />

        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Approving posts a reversal and updates the balance together.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => decide("reject")}
            >
              {busy === "reject" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <XCircle />
              )}
              Reject
            </Button>
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() => decide("approve")}
            >
              {busy === "approve" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CheckCircle2 />
              )}
              Approve credit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DisputesQueue() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [disputes, setDisputes] = useState<DisputeCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<
    { dispute: DisputeCase; decision: Decision }[]
  >([]);

  // Nothing here sets state before the first await, so the effect below only
  // schedules work rather than updating state while rendering.
  const load = useCallback(async () => {
    try {
      const info = await getSessionInfo();
      setSession(info);
      // Only staff may read the queue; the backend refuses anyone else anyway.
      setDisputes(info.isStaff ? await getPendingDisputes() : []);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof ApiError
          ? loadError.message
          : "Could not reach the backend. Is it running on port 8000?",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch on mount: the queue needs the reviewer's Firebase token, which only
    // exists on the client, so this cannot be loaded during render or on the
    // server. load() awaits before it touches state; the rule flags the call
    // regardless because state is set somewhere inside it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // Cases arrive from the customer app, so refresh while the page is open.
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [load]);

  const handleDecided = (updated: DisputeCase, decision: Decision) => {
    setDisputes((current) => current.filter((item) => item.id !== updated.id));
    setDecided((current) => [{ dispute: updated, decision }, ...current]);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading cases…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
          <RefreshCw />
          Try again
        </Button>
      </div>
    );
  }

  if (session && !session.isStaff) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          This account cannot review disputes.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Reviewers are listed in <code className="font-mono">STAFF_EMAILS</code> in{" "}
          <code className="font-mono">backend/.env</code>. Add{" "}
          <span className="font-mono">{session.email ?? "this account"}</span> and restart
          the backend, then sign out and back in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {disputes.length === 0
            ? "No cases waiting."
            : `${disputes.length} case${disputes.length === 1 ? "" : "s"} waiting`}
        </p>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw />
          Refresh
        </Button>
      </div>

      {disputes.map((dispute) => (
        <CaseCard key={dispute.id} dispute={dispute} onDecided={handleDecided} />
      ))}

      {disputes.length === 0 && decided.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Cases opened in the customer app land here within ten seconds.
          </p>
        </div>
      )}

      {decided.length > 0 && (
        <div className="pt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Decided this session
          </h2>
          <div className="mt-3 space-y-2">
            {decided.map(({ dispute, decision }) => (
              <div
                key={dispute.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-2 text-sm">
                  {decision === "approve" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-foreground">
                    {dispute.merchant ?? dispute.id}
                  </span>
                  <StatusBadge status={dispute.status} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {decision === "approve"
                    ? `${formatAmount(dispute.reversalAmountCents)} credited`
                    : "No credit"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
