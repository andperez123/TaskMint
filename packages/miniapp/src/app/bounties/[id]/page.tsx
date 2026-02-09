"use client";

import { useParams, useRouter } from "next/navigation";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { BOUNTY_ABI, FACTORY_ABI, FACTORY_ADDRESS, ROUTER_ADDRESS, VERIFIER_URL } from "@/config/contracts";
import { formatReward, shortenAddress, timeLeft } from "@/lib/format";
import { PROOF_TYPE_LABELS, ProofType } from "@/lib/types";
import { encodePacked, encodeAbiParameters, parseAbiParameters, type Address, type Hex } from "viem";
import { useState } from "react";

export default function BountyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { address: userAddress, isConnected } = useAccount();
  const [claimError, setClaimError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [attestationUID, setAttestationUID] = useState<string | null>(null);

  // Social verification form state
  const [fid, setFid] = useState("");

  // Resolve bounty address from factory
  const { data: bountyAddress } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "bounties",
    args: [BigInt(id)],
  });

  const bountyAddr = bountyAddress as Address | undefined;

  // Read bounty state
  const { data: creator } = useReadContract({
    address: bountyAddr, abi: BOUNTY_ABI, functionName: "creator",
    query: { enabled: !!bountyAddr },
  });
  const { data: rewardToken } = useReadContract({
    address: bountyAddr, abi: BOUNTY_ABI, functionName: "rewardToken",
    query: { enabled: !!bountyAddr },
  });
  const { data: remaining } = useReadContract({
    address: bountyAddr, abi: BOUNTY_ABI, functionName: "remainingReward",
    query: { enabled: !!bountyAddr },
  });
  const { data: payout } = useReadContract({
    address: bountyAddr, abi: BOUNTY_ABI, functionName: "payoutPerWinner",
    query: { enabled: !!bountyAddr },
  });
  const { data: maxWinners } = useReadContract({
    address: bountyAddr, abi: BOUNTY_ABI, functionName: "maxWinners",
    query: { enabled: !!bountyAddr },
  });
  const { data: winnersCount } = useReadContract({
    address: bountyAddr, abi: BOUNTY_ABI, functionName: "winnersCount",
    query: { enabled: !!bountyAddr },
  });
  const { data: deadline } = useReadContract({
    address: bountyAddr, abi: BOUNTY_ABI, functionName: "deadline",
    query: { enabled: !!bountyAddr },
  });
  const { data: proofType } = useReadContract({
    address: bountyAddr, abi: BOUNTY_ABI, functionName: "proofType",
    query: { enabled: !!bountyAddr },
  });
  const { data: hasClaimed } = useReadContract({
    address: bountyAddr,
    abi: BOUNTY_ABI,
    functionName: "claimed",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!bountyAddr && !!userAddress },
  });

  // Write: claim
  const { writeContract: writeClaim, data: claimTxHash, isPending: claiming } = useWriteContract();
  const { isLoading: claimConfirming, isSuccess: claimSuccess } =
    useWaitForTransactionReceipt({ hash: claimTxHash });

  // Write: withdraw
  const { writeContract: writeWithdraw, data: withdrawTxHash, isPending: withdrawing } = useWriteContract();
  const { isLoading: withdrawConfirming, isSuccess: withdrawSuccess } =
    useWaitForTransactionReceipt({ hash: withdrawTxHash });

  const isCreator = userAddress && creator && userAddress.toLowerCase() === (creator as string).toLowerCase();
  const expired = deadline ? Number(deadline) * 1000 < Date.now() : false;
  const filled = maxWinners !== undefined && winnersCount !== undefined && Number(winnersCount) >= Number(maxWinners);
  const isSocialBounty = proofType === ProofType.EAS_ATTESTATION;

  async function handleSocialVerify() {
    if (!bountyAddr || !userAddress) return;
    setClaimError(null);
    setVerifying(true);

    try {
      const resp = await fetch(`${VERIFIER_URL}/proof/social/attest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bountyId: bountyAddr,
          executorWallet: userAddress,
          fid: Number(fid),
          castHash: "auto", // verifier will validate via Neynar, or mock
          actionType: "like", // TODO: read from bounty spec
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setClaimError(data.error || "Verification failed");
        return;
      }

      setAttestationUID(data.attestationUID);
    } catch (e: any) {
      setClaimError(e?.message ?? "Verification request failed");
    } finally {
      setVerifying(false);
    }
  }

  function handleClaim() {
    if (!bountyAddr) return;
    setClaimError(null);

    let proof: `0x${string}` = "0x";

    if (proofType === ProofType.TX_EVENT) {
      proof = encodePacked(["address"], [ROUTER_ADDRESS]) as `0x${string}`;
    } else if (proofType === ProofType.EAS_ATTESTATION && attestationUID) {
      proof = encodeAbiParameters(
        parseAbiParameters("bytes32"),
        [attestationUID as Hex]
      );
    }

    try {
      writeClaim({
        address: bountyAddr,
        abi: BOUNTY_ABI,
        functionName: "claim",
        args: [proof],
      });
    } catch (e: any) {
      setClaimError(e?.message ?? "Claim failed");
    }
  }

  function handleWithdraw() {
    if (!bountyAddr) return;
    writeWithdraw({
      address: bountyAddr,
      abi: BOUNTY_ABI,
      functionName: "withdrawUnclaimed",
    });
  }

  if (!bountyAddr) {
    return (
      <main className="min-h-screen px-4 py-8 max-w-lg mx-auto">
        <p className="text-gray-500">Loading bounty...</p>
      </main>
    );
  }

  const payoutFormatted = payout !== undefined ? formatReward(payout as bigint) : "...";

  return (
    <main className="min-h-screen px-4 py-6 max-w-lg mx-auto pb-24">
      <button onClick={() => router.back()} className="text-sm text-brand-400 mb-4">
        &larr; Back
      </button>

      {/* Hero card */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          {isSocialBounty ? (
            <span className="text-xs font-medium bg-purple-500/20 text-purple-300 px-2.5 py-1 rounded-full">Social</span>
          ) : (
            <span className="text-xs font-medium bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full">Onchain</span>
          )}
          {expired && <span className="text-xs font-medium bg-red-500/20 text-red-300 px-2.5 py-1 rounded-full">Expired</span>}
          {filled && <span className="text-xs font-medium bg-yellow-500/20 text-yellow-300 px-2.5 py-1 rounded-full">Filled</span>}
          {!expired && !filled && <span className="text-xs font-medium bg-green-500/20 text-green-300 px-2.5 py-1 rounded-full">Active</span>}
        </div>

        <h1 className="text-xl font-bold mb-1">Bounty #{id}</h1>
        <p className="text-xs text-gray-500 font-mono mb-4">{bountyAddr}</p>

        {/* Big reward display */}
        <div className="text-center py-4">
          <p className="text-3xl font-bold text-brand-400">{payoutFormatted} ETH</p>
          <p className="text-sm text-gray-400 mt-1">per {isSocialBounty ? "person" : "winner"}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          <div className="text-center">
            <p className="text-xs text-gray-500">Spots left</p>
            <p className="font-semibold">{maxWinners !== undefined ? `${Math.max(0, Number(maxWinners) - Number(winnersCount ?? 0))}` : "..."}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Claimed</p>
            <p className="font-semibold">{winnersCount !== undefined ? `${winnersCount}/${maxWinners}` : "..."}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Time left</p>
            <p className="font-semibold">{deadline ? timeLeft(Number(deadline)) : "..."}</p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-xl border border-white/10 p-4 mb-6 space-y-2 text-sm">
        <Row label="Creator" value={creator ? shortenAddress(creator as string) : "..."} />
        <Row label="Type" value={isSocialBounty ? "Social Engagement" : proofType !== undefined ? PROOF_TYPE_LABELS[proofType as ProofType] ?? `#${proofType}` : "..."} />
        <Row label="Remaining Pool" value={remaining !== undefined ? `${formatReward(remaining as bigint)} ETH` : "..."} />
        <Row label="Token" value={rewardToken === "0x0000000000000000000000000000000000000000" ? "ETH" : shortenAddress((rewardToken as string) ?? "")} />
      </div>

      {/* ── Social bounty: step-by-step claim flow ── */}
      {isSocialBounty && !isCreator && !expired && !filled && !hasClaimed && !claimSuccess && (
        <div className="space-y-4 mb-6">
          {/* Step 1: Already done */}
          <StepCard
            step={1}
            title={`Engage with the cast`}
            description="Go to Farcaster, find the cast, and perform the required action (like, recast, or reply)."
            done={!!attestationUID}
          />

          {/* Step 2: Verify */}
          <StepCard
            step={2}
            title="Verify your action"
            description="Enter your Farcaster ID so we can confirm you performed the action."
            done={!!attestationUID}
            active={!attestationUID}
          >
            {!attestationUID && (
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="text-xs text-gray-400">Your Farcaster FID</span>
                  <input
                    type="number"
                    min="1"
                    value={fid}
                    onChange={(e) => setFid(e.target.value)}
                    placeholder="e.g. 12345"
                    className="input mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Find your FID at warpcast.com — it&apos;s in your profile settings.
                  </p>
                </label>

                <button
                  onClick={handleSocialVerify}
                  disabled={verifying || !fid || !isConnected}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {verifying ? "Checking..." : "Verify My Action"}
                </button>
              </div>
            )}
          </StepCard>

          {/* Step 3: Claim */}
          <StepCard
            step={3}
            title="Claim your reward"
            description={`Once verified, claim ${payoutFormatted} ETH directly to your wallet.`}
            done={claimSuccess}
            active={!!attestationUID && !claimSuccess}
          />
        </div>
      )}

      {/* ── Actions ── */}
      <div className="space-y-3">
        {!isConnected && (
          <p className="text-center text-gray-400 text-sm py-3">Connect your wallet to interact with this bounty.</p>
        )}

        {/* Social claim button */}
        {isConnected && isSocialBounty && !isCreator && !expired && !filled && !hasClaimed && (
          <button
            onClick={handleClaim}
            disabled={claiming || claimConfirming || !attestationUID}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors"
          >
            {claiming || claimConfirming
              ? "Processing..."
              : !attestationUID
              ? "Complete verification first"
              : `Claim ${payoutFormatted} ETH`}
          </button>
        )}

        {/* Onchain claim button */}
        {isConnected && !isSocialBounty && !isCreator && !expired && !filled && !hasClaimed && (
          <button
            onClick={handleClaim}
            disabled={claiming || claimConfirming}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-colors"
          >
            {claiming || claimConfirming ? "Processing..." : "Verify + Claim"}
          </button>
        )}

        {hasClaimed && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-2">
              <span className="text-green-400 text-xl">&#10003;</span>
            </div>
            <p className="text-green-400 font-medium">You claimed this bounty!</p>
          </div>
        )}

        {claimSuccess && !hasClaimed && (
          <div className="text-center py-4">
            <p className="text-green-400 font-medium">Claim successful! {payoutFormatted} ETH sent to your wallet.</p>
          </div>
        )}

        {claimError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-red-400 text-sm">{claimError}</p>
          </div>
        )}

        {/* Withdraw (creator, after deadline) */}
        {isCreator && expired && remaining !== undefined && (remaining as bigint) > 0n && (
          <button
            onClick={handleWithdraw}
            disabled={withdrawing || withdrawConfirming}
            className="w-full border border-white/20 hover:bg-white/5 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {withdrawing || withdrawConfirming ? "Processing..." : "Withdraw Unclaimed Funds"}
          </button>
        )}

        {withdrawSuccess && (
          <p className="text-center text-green-400 text-sm">Withdrawal successful!</p>
        )}
      </div>
    </main>
  );
}

/* ─── Sub-components ─── */

function StepCard({
  step,
  title,
  description,
  done,
  active,
  children,
}: {
  step: number;
  title: string;
  description: string;
  done?: boolean;
  active?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      done
        ? "border-green-500/30 bg-green-500/5"
        : active
        ? "border-brand-500/30 bg-brand-900/10"
        : "border-white/10 bg-white/[0.02] opacity-60"
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          done ? "bg-green-500 text-white" : active ? "bg-brand-600 text-white" : "bg-white/10 text-gray-500"
        }`}>
          {done ? "\u2713" : step}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${done ? "text-green-400" : ""}`}>{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
