"use client";

import Link from "next/link";
import { type BountyMeta, ProofType } from "@/lib/types";
import { formatReward, shortenAddress, timeLeft } from "@/lib/format";

interface Props {
  bounty: BountyMeta;
}

export function BountyCard({ bounty }: Props) {
  const expired = bounty.deadline * 1000 < Date.now();
  const filled = bounty.winnersCount >= bounty.maxWinners;
  const isSocial = bounty.proofType === ProofType.EAS_ATTESTATION;

  return (
    <Link
      href={`/bounties/${bounty.id}`}
      className="block rounded-xl border border-white/10 hover:border-brand-500/40 p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            {isSocial ? (
              <span className="text-[10px] font-medium bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">Social</span>
            ) : (
              <span className="text-[10px] font-medium bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Onchain</span>
            )}
            {!expired && !filled && (
              <span className="text-[10px] font-medium bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">Active</span>
            )}
            {expired && (
              <span className="text-[10px] font-medium bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">Expired</span>
            )}
            {filled && (
              <span className="text-[10px] font-medium bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">Filled</span>
            )}
          </div>
          <p className="font-semibold truncate">Bounty #{bounty.id}</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            {shortenAddress(bounty.address)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-brand-400">
            {formatReward(bounty.payoutPerWinner)} ETH
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            per {isSocial ? "person" : "winner"}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs">
        <span className={expired || filled ? "text-gray-500" : "text-gray-400"}>
          {filled ? "All spots filled" : expired ? "Expired" : timeLeft(bounty.deadline)}
        </span>
        <span className="text-gray-500">
          {bounty.winnersCount}/{bounty.maxWinners} claimed
        </span>
      </div>
    </Link>
  );
}
