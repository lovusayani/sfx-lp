"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Handshake, Link2, ShoppingCart } from "lucide-react";

import { ActivityList, EmptyState, Skeleton } from "@/components/sfx/ActivityList";
import { ActivityItem } from "@/components/sfx/activity";
import { formatMoney } from "@/components/sfx/format";
import { KycGate, OptionCard, TextArea } from "@/components/sfx/kit";
import { UploadTile } from "@/components/sfx/UploadTile";
import { Alert, Button, ButtonLink, Chip, Display, Eyebrow, Field, SectionTitle, TopBar } from "@/components/sfx/ui";
import { useHydratedUser } from "@/hooks/useHydratedUser";
import { getPublicAssetUrl } from "@/services/api";
import { getDepositeHistory, getPaymentSetupConfig, submitDeposite } from "@/services/user.service";
import { DepositeNetwork, DepositeRecord, PaymentSetupConfig } from "@/types";

type Method = "on_chain" | "f2f";
type Step = 1 | 2 | 3 | "done";
const NETWORKS: Array<{ id: DepositeNetwork; label: string; body: string }> = [
  { id: "TRC20", label: "TRC20", body: "USDT on Tron" },
  { id: "ERC20", label: "ERC20", body: "USDT on Ethereum" },
  { id: "BEP20", label: "BEP20", body: "USDT on BNB Smart Chain" },
];

const toActivity = (d: DepositeRecord): ActivityItem => ({
  id: `dep-${d.id}`,
  kind: "deposit",
  title: d.status === "approved" ? "Deposit credited" : d.status === "rejected" ? "Deposit rejected" : "Deposit pending",
  amount: d.amount,
  status: d.status,
  createdAt: d.createdAt,
  detail: d.network || (d.depositeType === "f2f" ? "Face to face" : undefined),
});

/** Deposit: amount & method → payment details → proof → done. */
export default function DepositPage() {
  const { user } = useHydratedUser();
  const [config, setConfig] = useState<PaymentSetupConfig | null>(null);
  const [history, setHistory] = useState<DepositeRecord[] | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("on_chain");
  const [network, setNetwork] = useState<DepositeNetwork | null>(null);
  const [proof, setProof] = useState<File | undefined>();
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getPaymentSetupConfig().then(setConfig, () => setConfig({ networks: {} as PaymentSetupConfig["networks"] }));
    getDepositeHistory().then(setHistory, () => setHistory([]));
  }, []);

  const isReady = (n: DepositeNetwork) => Boolean(config?.networks?.[n]?.walletAddress?.trim());
  const readyNetworks = useMemo(() => NETWORKS.filter((n) => isReady(n.id)), [config]); // eslint-disable-line react-hooks/exhaustive-deps
  const net = network ? config?.networks?.[network] : undefined;
  const numericAmount = Number(amount);

  if (user && user.kycStatus !== "approved") {
    return (
      <div className="sfx-enter flex flex-col gap-3.5">
        <TopBar backHref="/dashboard/wallet" caption="DEPOSIT" />
        <Display size="md" title="Add funds" />
        <KycGate status={user.kycStatus} />
      </div>
    );
  }

  const next = () => {
    setError("");
    if (step === 1) {
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError("Enter the amount you want to deposit.");
      if (method === "on_chain" && !network && readyNetworks[0]) setNetwork(readyNetworks[0].id);
      setStep(2);
    } else if (step === 2) {
      if (method === "on_chain" && (!network || !isReady(network))) return setError("Choose an available network.");
      setStep(3);
    }
  };

  const submit = async () => {
    if (!proof) return setError("Add a screenshot or PDF of your payment.");
    setBusy(true);
    setError("");
    try {
      const created = await submitDeposite({
        amount: numericAmount,
        depositeType: method,
        network: method === "on_chain" ? network ?? undefined : undefined,
        remarks: remarks.trim(),
        screenshot: proof,
      });
      setHistory((prev) => [created, ...(prev || [])]);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't submit your deposit. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setStep(1);
    setAmount("");
    setProof(undefined);
    setRemarks("");
    setError("");
  };

  const copy = async () => {
    if (!net?.walletAddress) return;
    try {
      await navigator.clipboard.writeText(net.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked: the address is selectable as a fallback
    }
  };

  return (
    <div className="sfx-enter flex flex-col gap-3.5">
      <TopBar
        onBack={step === 2 ? () => setStep(1) : step === 3 ? () => setStep(2) : undefined}
        backHref={step === 1 || step === "done" ? "/dashboard/wallet" : undefined}
        caption={step === "done" ? "DEPOSIT" : `STEP ${step} OF 3`}
      />

      <div className="grid gap-3.5 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <div className="flex flex-col gap-3.5">
          {step === 1 && (
            <>
              <Display size="md" title="Add funds" subtitle="Deposits are credited to your Main wallet after our team confirms the payment." />
              <Field
                label="Amount (USDT)"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="flex flex-col gap-3" role="radiogroup" aria-label="Deposit method">
                <Eyebrow>Method</Eyebrow>
                <OptionCard
                  icon={Link2}
                  title="On-chain transfer"
                  body="Send USDT from any crypto wallet"
                  selected={method === "on_chain"}
                  onClick={() => setMethod("on_chain")}
                  disabled={config !== null && readyNetworks.length === 0}
                />
                <OptionCard
                  icon={Handshake}
                  title="Face to face"
                  body="Pay in person, then upload the receipt"
                  selected={method === "f2f"}
                  onClick={() => setMethod("f2f")}
                />
                <OptionCard
                  icon={ShoppingCart}
                  title="Buy crypto"
                  body="Card and bank purchases"
                  selected={false}
                  onClick={() => undefined}
                  disabled
                  badge={<Chip tone="neutral">SOON</Chip>}
                />
              </div>
            </>
          )}

          {step === 2 && method === "on_chain" && (
            <>
              <Display size="md" title="Send the payment" subtitle={`Send exactly ${formatMoney(numericAmount)} USDT on the network you choose.`} />
              <div className="flex flex-col gap-3" role="radiogroup" aria-label="Network">
                {NETWORKS.map((n) => (
                  <OptionCard
                    key={n.id}
                    title={n.label}
                    body={isReady(n.id) ? n.body : "Not available right now"}
                    selected={network === n.id}
                    disabled={!isReady(n.id)}
                    onClick={() => setNetwork(n.id)}
                  />
                ))}
              </div>
              {net?.walletAddress && (
                <section className="sfx-card flex flex-col items-center gap-4 p-4" aria-label="Deposit address">
                  {net.qrCodePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getPublicAssetUrl(net.qrCodePath)}
                      alt={`${network} deposit QR code`}
                      className="h-44 w-44 rounded-[12px] bg-white object-contain p-2"
                    />
                  ) : null}
                  <div className="w-full">
                    <Eyebrow className="mb-2">{network} address</Eyebrow>
                    <div className="flex items-center gap-2 rounded-[10px] border border-sfx-line bg-sfx-field px-4 py-3">
                      <code className="min-w-0 flex-1 break-all text-[13px] text-sfx-text">{net.walletAddress}</code>
                      <button
                        type="button"
                        onClick={copy}
                        aria-label="Copy address"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sfx-accent hover:bg-sfx-gold-soft/50"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[12px] text-sfx-muted">Only send USDT on {network}. Funds sent on another network can be lost.</p>
                </section>
              )}
            </>
          )}

          {step === 2 && method === "f2f" && (
            <>
              <Display size="md" title="Pay in person" subtitle={`Hand over ${formatMoney(numericAmount)} to your Swiss Liquidity representative and keep the receipt.`} />
              <Alert tone="info">On the next step you’ll upload a photo of the receipt so we can credit your wallet.</Alert>
            </>
          )}

          {step === 3 && (
            <>
              <Display size="md" title="Confirm your payment" subtitle="Upload proof of payment. We’ll credit your Main wallet once it’s verified." />
              <dl className="sfx-tile grid grid-cols-2 gap-y-3 p-4 text-[13px]">
                <dt className="text-sfx-muted">Amount</dt>
                <dd className="text-right font-semibold tabular-nums text-sfx-text">{formatMoney(numericAmount)}</dd>
                <dt className="text-sfx-muted">Method</dt>
                <dd className="text-right text-sfx-text">{method === "on_chain" ? `On-chain · ${network}` : "Face to face"}</dd>
              </dl>
              <UploadTile title="Payment screenshot or receipt" file={proof} onFile={setProof} onError={setError} tall />
              <TextArea
                label="Note (optional)"
                placeholder="Transaction hash, reference or anything that helps us match your payment"
                value={remarks}
                maxLength={500}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </>
          )}

          {step === "done" && (
            <section className="sfx-card flex flex-col items-center gap-3 px-4 py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sfx-gold-soft text-sfx-accent">
                <Check size={26} />
              </span>
              <p className="text-[20px] font-semibold text-sfx-text">Deposit submitted</p>
              <p className="max-w-xs text-[13px] text-sfx-muted">
                We’re checking your payment of {formatMoney(numericAmount)}. You’ll see it in your Main wallet as soon as it’s confirmed.
              </p>
              <div className="mt-3 flex w-full max-w-xs flex-col gap-2">
                <ButtonLink href="/dashboard/wallet">Back to wallet</ButtonLink>
                <Button variant="ghost" onClick={restart}>
                  Make another deposit
                </Button>
              </div>
            </section>
          )}

          {error && <Alert>{error}</Alert>}
          {step === 1 || step === 2 ? (
            <Button onClick={next} disabled={config === null}>
              Continue
            </Button>
          ) : step === 3 ? (
            <Button onClick={submit} loading={busy}>
              Submit deposit
            </Button>
          ) : null}
        </div>

        <section className="flex flex-col gap-4" aria-label="Deposit history">
          <SectionTitle>Recent deposits</SectionTitle>
          {history === null ? (
            <Skeleton className="h-[160px]" />
          ) : history.length === 0 ? (
            <EmptyState title="No deposits yet" body="Your deposits and their status will appear here." />
          ) : (
            <ActivityList items={history.slice(0, 8).map(toActivity)} showDates />
          )}
        </section>
      </div>
    </div>
  );
}
