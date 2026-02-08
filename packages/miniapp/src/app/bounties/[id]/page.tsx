"use client";

import { useParams, useRouter } from "next/navigation";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { BOUNTY_ABI, FACTORY_ABI, FACTORY_ADDRESS, ROUTER_ADDRESS } from "@/config/contracts";
import { formatReward, shortenAddress, timeLeft } from "@/lib/format";
import { PROOF_TYPE_LABELS, ProofType } from "@/lib/types";
import { encodePacked, type Address } from "viem";
import { useState } from "react";

export default function BountyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { address: userAddress } = useAccount();
  const [claimError, setClaimError] = useState<string | null>(null);

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
    address: bountyAddr,
    abi: BOUNTY_ABI,
    functionName: "creator",
    query: { enabled: !!bountyAddr },
  });
  const { data: rewardToken } = useReadContract({
    address: bountyAddr,
    abi: BOUNTY_ABI,
    functionName: "rewardToken",
    query: { enabled: !!bountyAddr },
  });
  const { data: remaining } = useReadContract({
    address: bountyAddr,
    abi: BOUNTY_ABI,
    functionName: "remainingReward",
    query: { enabled: !!bountyAddr },
  });
  const { data: payout } = useReadContract({
    address: bountyAddr,
    abi: BOUNTY_ABI,
    functionName: "payoutPerWinner",
    query: { enabled: !!bountyAddr },
  });
  const { data: maxWinners } = useReadContract({
    address: bountyAddr,
    abi: BOUNTY_ABI,
    functionName: "maxWinners",
    query: { enabled: !!bountyAddr },
  });
  const { data: winnersCount } = useReadContract({
    address: bountyAddr,
    abi: BOUNTY_ABI,
    functionName: "winnersCount",
    query: { enabled: !!bountyAddr },
  });
  const { data: deadline } = useReadContract({
    address: bountyAddr,
    abi: BOUNTY_ABI,
    functionName: "deadline",
    query: { enabled: !!bountyAddr },
  });
  const { data: proofType } = useReadContract({
    address: bountyAddr,
    abi: BOUNTY_ABI,
    functionName: "proofType",
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

  function handleClaim() {
    if (!bountyAddr) return;
    setClaimError(null);

    // For TX_EVENT, proof = abi.encode(routerAddress) -- executor must have completed via router first
    // For STATE_PREDICATE, proof is empty (contract reads state directly)
    // For EAS_ATTESTATION, user must supply attestation UID (TODO: UI for that in Phase 2)
    let proof: `0x${string}` = "0x";
    if (proofType === ProofType.TX_EVENT) {
      proof = encodePacked(["address"], [ROUTER_ADDRESS]) as `0x${string}`;
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

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto pb-24">
      <button onClick={() => router.back()} className="text-sm text-brand-400 mb-4">
        &larr; Back
      </button>

      <h1 className="text-2xl font-bold mb-1">Bounty #{id}</h1>
      <p className="text-xs text-gray-500 font-mono mb-6">{bountyAddr}</p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Remaining" value={remaining !== undefined ? `${formatReward(remaining as bigint)} ETH` : "..."} />
        <StatCard label="Per Winner" value={payout !== undefined ? `${formatReward(payout as bigint)} ETH` : "..."} />
        <StatCard label="Winners" value={maxWinners !== undefined ? `${winnersCount ?? 0}/${maxWinners}` : "..."} />
        <StatCard label="Deadline" value={deadline ? timeLeft(Number(deadline)) : "..."} />
      </div>

      {/* Details */}
      <div className="rounded-xl border border-white/10 p-4 mb-6 space-y-2 text-sm">
        <Row label="Creator" value={creator ? shortenAddress(creator as string) : "..."} />
        <Row label="Proof Type" value={proofType !== undefined ? PROOF_TYPE_LABELS[proofType as ProofType] ?? `#${proofType}` : "..."} />
        <Row label="Reward Token" value={rewardToken === "0x0000000000000000000000000000000000000000" ? "ETH" : shortenAddress((rewardToken as string) ?? "")} />
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {/* Claim button */}
        {!isCreator && !expired && !filled && !hasClaimed && (
          <button
            onClick={handleClaim}
            disabled={claiming || claimConfirming}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {claiming || claimConfirming ? "Processing..." : "Verify + Claim"}
          </button>
        )}

        {hasClaimed && (
          <p className="text-center text-green-400 font-medium py-3">You already claimed this bounty</p>
        )}

        {claimSuccess && (
          <p className="text-center text-green-400 text-sm">Claim successful!</p>
        )}

        {claimError && (
          <p className="text-center text-red-400 text-sm">{claimError}</p>
        )}

        {/* Withdraw button (creator only, after deadline) */}
        {isCreator && expired && remaining !== undefined && (remaining as bigint) > 0n && (
          <button
            onClick={handleWithdraw}
            disabled={withdrawing || withdrawConfirming}
            className="w-full border border-white/20 hover:bg-white/5 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {withdrawing || withdrawConfirming ? "Processing..." : "Withdraw Unclaimed"}
          </button>
        )}

        {withdrawSuccess && (
          <p className="text-center text-green-400 text-sm">Withdrawal successful!</p>
        )}
      </div>
    </main>
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
