"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, keccak256, toBytes, encodeAbiParameters, parseAbiParameters } from "viem";
import { FACTORY_ABI, FACTORY_ADDRESS, ROUTER_ADDRESS, SOCIAL_SCHEMA_UID } from "@/config/contracts";
import { ProofType } from "@/lib/types";

type BountyKind = "social" | "onchain" | null;

export default function CreateBountyPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  // Step 1: pick the type
  const [kind, setKind] = useState<BountyKind>(null);

  // Shared fields
  const [title, setTitle] = useState("");
  const [rewardEth, setRewardEth] = useState("");
  const [payoutEth, setPayoutEth] = useState("");
  const [maxWinners, setMaxWinners] = useState("10");
  const [deadlineDays, setDeadlineDays] = useState("7");

  // Social-specific fields
  const [castUrl, setCastUrl] = useState("");
  const [socialAction, setSocialAction] = useState<"like" | "recast" | "reply">("like");

  // Onchain-specific fields
  const [description, setDescription] = useState("");

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const proofType = kind === "social" ? ProofType.EAS_ATTESTATION : ProofType.TX_EVENT;

  function buildVerificationData(): `0x${string}` {
    if (proofType === ProofType.TX_EVENT) {
      return encodeAbiParameters(parseAbiParameters("address"), [ROUTER_ADDRESS]);
    }
    if (proofType === ProofType.EAS_ATTESTATION) {
      return encodeAbiParameters(
        [{
          type: "tuple",
          components: [
            { type: "bytes32", name: "schemaUID" },
            { type: "address[]", name: "approvedAttesters" },
          ],
        }],
        [{ schemaUID: SOCIAL_SCHEMA_UID as `0x${string}`, approvedAttesters: [] }]
      );
    }
    return "0x";
  }

  // Extract a cast hash from a Warpcast URL or raw hash
  function extractCastRef(): string {
    const trimmed = castUrl.trim();
    // If it's already a hash, use as-is
    if (trimmed.startsWith("0x")) return trimmed;
    // Try to extract from warpcast URL: https://warpcast.com/username/0xabc123
    const match = trimmed.match(/warpcast\.com\/[^/]+\/(0x[a-fA-F0-9]+)/);
    if (match) return match[1];
    // Otherwise just use the whole string
    return trimmed;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isConnected || !address || !kind) return;

    const rewardAmount = parseEther(rewardEth);
    const payoutPerWinner = parseEther(payoutEth);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(deadlineDays) * 86400);

    const displayTitle = title || (kind === "social"
      ? `${ACTION_LABELS[socialAction]} my cast`
      : "Complete an onchain task");

    const titleHash = keccak256(toBytes(displayTitle));
    const verificationData = buildVerificationData();

    const castRef = kind === "social" ? extractCastRef() : "";
    const specURI = kind === "social"
      ? `social://${socialAction}/${castRef}`
      : description || "ipfs://TODO";

    writeContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "createBounty",
      args: [
        {
          titleHash,
          specURI,
          rewardToken: "0x0000000000000000000000000000000000000000" as `0x${string}`,
          rewardAmount,
          payoutPerWinner,
          maxWinners: Number(maxWinners),
          deadline,
          proofType,
          verificationData,
        },
      ],
      value: rewardAmount,
    });
  }

  // Fee preview
  const totalEth = parseFloat(rewardEth) || 0;
  const fee = totalEth * 0.025;
  const escrowed = totalEth - fee;
  const perWinnerEth = parseFloat(payoutEth) || 0;
  const maxPossibleWinners = perWinnerEth > 0 ? Math.floor(escrowed / perWinnerEth) : 0;

  return (
    <main className="min-h-screen px-4 py-6 max-w-lg mx-auto pb-24">
      <button onClick={() => kind ? setKind(null) : router.back()} className="text-sm text-brand-400 mb-4">
        &larr; {kind ? "Change type" : "Back"}
      </button>

      {!isConnected ? (
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold mb-3">Post a Bounty</h1>
          <p className="text-gray-400 mb-2">Connect your wallet to get started.</p>
          <p className="text-sm text-gray-500">Use the button in the top right.</p>
        </div>
      ) : isSuccess ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-green-400 text-3xl">&#10003;</span>
          </div>
          <p className="text-green-400 font-semibold text-lg mb-2">Bounty is live!</p>
          <p className="text-gray-400 text-sm mb-6">
            Your ETH is escrowed. People can now {kind === "social" ? `${socialAction} your cast` : "complete your task"} and claim the reward.
          </p>
          <p className="text-gray-500 text-xs mb-4 font-mono break-all">Tx: {txHash}</p>
          <button
            onClick={() => router.push("/")}
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            View All Bounties
          </button>
        </div>
      ) : !kind ? (
        /* ──── Step 1: Pick bounty type ──── */
        <div>
          <h1 className="text-2xl font-bold mb-2">What do you want people to do?</h1>
          <p className="text-sm text-gray-400 mb-8">Pick a bounty type to get started.</p>

          <div className="space-y-4">
            <TypeCard
              title="Get Social Engagement"
              description="Pay people to like, recast, or reply to your Farcaster cast"
              emoji="&#128172;"
              tag="Social"
              onClick={() => setKind("social")}
            />
            <TypeCard
              title="Complete an Onchain Task"
              description="Pay people to perform a specific onchain action (swap, mint, provide liquidity, etc.)"
              emoji="&#9939;"
              tag="Onchain"
              onClick={() => setKind("onchain")}
            />
          </div>
        </div>
      ) : (
        /* ──── Step 2: Details form ──── */
        <div>
          <h1 className="text-2xl font-bold mb-1">
            {kind === "social" ? "Social Engagement Bounty" : "Onchain Task Bounty"}
          </h1>
          <p className="text-sm text-gray-400 mb-6">
            {kind === "social"
              ? "Pay people to engage with your Farcaster cast."
              : "Pay people to complete a specific onchain action."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {kind === "social" ? (
              /* ── Social-specific fields ── */
              <>
                <Field label="What action should people take?">
                  <div className="grid grid-cols-3 gap-2">
                    {(["like", "recast", "reply"] as const).map((action) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => setSocialAction(action)}
                        className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          socialAction === action
                            ? "bg-purple-600 text-white"
                            : "bg-white/10 text-gray-300 hover:bg-white/15"
                        }`}
                      >
                        {ACTION_EMOJI[action]} {ACTION_LABELS[action]}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Farcaster Cast Link or Hash">
                  <input
                    type="text"
                    value={castUrl}
                    onChange={(e) => setCastUrl(e.target.value)}
                    required
                    placeholder="https://warpcast.com/you/0xabc123  or  0xabc123"
                    className="input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Paste the Warpcast link to your cast, or the cast hash directly.
                  </p>
                </Field>

                <Field label="Bounty Title (optional)">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`${ACTION_LABELS[socialAction]} my cast`}
                    className="input"
                  />
                </Field>
              </>
            ) : (
              /* ── Onchain-specific fields ── */
              <>
                <Field label="Task Title">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Add liquidity to USDC/ETH pool on Uniswap"
                    className="input"
                  />
                </Field>

                <Field label="Task Description">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe exactly what people need to do..."
                    rows={3}
                    className="input resize-none"
                  />
                </Field>
              </>
            )}

            {/* ── Reward settings (shared) ── */}
            <div className="border-t border-white/10 pt-5">
              <h3 className="font-semibold text-sm text-gray-300 mb-4">Reward Settings</h3>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Total Budget (ETH)">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={rewardEth}
                    onChange={(e) => setRewardEth(e.target.value)}
                    required
                    placeholder="0.1"
                    className="input"
                  />
                </Field>

                <Field label={`Per ${kind === "social" ? ACTION_LABELS[socialAction] : "Winner"} (ETH)`}>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={payoutEth}
                    onChange={(e) => setPayoutEth(e.target.value)}
                    required
                    placeholder="0.001"
                    className="input"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label={`Max ${kind === "social" ? "People" : "Winners"}`}>
                  <input
                    type="number"
                    min="1"
                    value={maxWinners}
                    onChange={(e) => setMaxWinners(e.target.value)}
                    required
                    className="input"
                  />
                </Field>

                <Field label="Expires In (days)">
                  <input
                    type="number"
                    min="1"
                    value={deadlineDays}
                    onChange={(e) => setDeadlineDays(e.target.value)}
                    required
                    className="input"
                  />
                </Field>
              </div>
            </div>

            {/* Fee breakdown */}
            {totalEth > 0 && perWinnerEth > 0 && (
              <div className="rounded-xl bg-white/5 p-4 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total budget</span>
                  <span>{totalEth} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Platform fee (2.5%)</span>
                  <span className="text-gray-400">-{fee.toFixed(6)} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Escrowed for rewards</span>
                  <span className="text-green-400">{escrowed.toFixed(6)} ETH</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-1.5 mt-1.5">
                  <span className="text-gray-400">
                    {kind === "social" ? "Max people paid" : "Max winners"}
                  </span>
                  <span className="font-semibold">
                    {Math.min(Number(maxWinners), maxPossibleWinners)} people x {perWinnerEth} ETH
                  </span>
                </div>
                {Number(maxWinners) > maxPossibleWinners && (
                  <p className="text-yellow-400 text-xs mt-1">
                    Budget only covers {maxPossibleWinners} people at {perWinnerEth} ETH each. Lower the max or increase your budget.
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm">
                {(error as any)?.shortMessage ?? error.message}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending || confirming}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors text-base"
            >
              {isPending || confirming
                ? "Confirming..."
                : `Fund & Launch Bounty (${rewardEth || "0"} ETH)`}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

/* ─── Constants ─── */

const ACTION_LABELS: Record<string, string> = {
  like: "Like",
  recast: "Recast",
  reply: "Reply",
};

const ACTION_EMOJI: Record<string, string> = {
  like: "\u2764\uFE0F",
  recast: "\uD83D\uDD01",
  reply: "\uD83D\uDCAC",
};

/* ─── Sub-components ─── */

function TypeCard({
  title,
  description,
  emoji,
  tag,
  onClick,
}: {
  title: string;
  description: string;
  emoji: string;
  tag: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-white/10 hover:border-brand-500/50 bg-white/5 hover:bg-white/[0.07] p-5 transition-all group"
    >
      <div className="flex items-start gap-4">
        <span className="text-3xl" dangerouslySetInnerHTML={{ __html: emoji }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-white group-hover:text-brand-400 transition-colors">{title}</span>
            <span className="text-[10px] font-medium bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">{tag}</span>
          </div>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
        <span className="text-gray-600 group-hover:text-brand-400 transition-colors mt-1">&rarr;</span>
      </div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-gray-400 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
