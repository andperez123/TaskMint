"use client";

import Link from "next/link";
import { type BountyMeta, PROOF_TYPE_LABELS } from "@/lib/types";
import { formatReward, shortenAddress, timeLeft } from "@/lib/format";

interface Props {
  bounty: BountyMeta;
}

export function BountyCard({ bounty }: Props) {
  const expired = bounty.deadline * 1000 < Date.now();
  const filled = bounty.winnersCount >= bounty.maxWinners;

  return (
    <Link
      href={`/bounties/${bounty.id}`}
      className="block rounded-xl border border-white/10 hover:border-brand-500/40 p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 font-mono mb-1">
            {shortenAddress(bounty.address)}
          </p>
          <p className="font-semibold truncate">Bounty #{bounty.id}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {PROOF_TYPE_LABELS[bounty.proofType]}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-brand-400">
            {formatReward(bounty.rewardAmount)} ETH
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {bounty.winnersCount}/{bounty.maxWinners} claimed
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs">
        <span
          className={
            expired || filled
              ? "text-red-400"
              : "text-green-400"
          }
        >
          {filled ? "Filled" : timeLeft(bounty.deadline)}
        </span>
        <span className="text-gray-500">
          {formatReward(bounty.payoutPerWinner)} ETH / winner
        </span>
      </div>
    </Link>
  );
}
