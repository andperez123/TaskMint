"use client";

import Link from "next/link";
import { useReadContract, usePublicClient } from "wagmi";
import { useEffect, useState } from "react";
import { type Address } from "viem";
import { FACTORY_ABI, FACTORY_ADDRESS, BOUNTY_ABI } from "@/config/contracts";
import { BountyCard } from "@/components/BountyCard";
import { type BountyMeta, ProofType } from "@/lib/types";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "social", label: "Social" },
  { key: "onchain", label: "Onchain" },
  { key: "active", label: "Active" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

export default function Home() {
  const publicClient = usePublicClient();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");

  const { data: bountyCount } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "bountyCount",
  });

  const [bounties, setBounties] = useState<BountyMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicClient || bountyCount === undefined) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      const results: BountyMeta[] = [];
      const count = Number(bountyCount);

      for (let i = 0; i < count; i++) {
        try {
          const bountyAddr = (await publicClient!.readContract({
            address: FACTORY_ADDRESS,
            abi: FACTORY_ABI,
            functionName: "bounties",
            args: [BigInt(i)],
          })) as Address;

          const [creator, rewardToken, remaining, payout, maxW, winC, dl, pt] =
            await Promise.all([
              publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "creator" }),
              publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "rewardToken" }),
              publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "remainingReward" }),
              publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "payoutPerWinner" }),
              publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "maxWinners" }),
              publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "winnersCount" }),
              publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "deadline" }),
              publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "proofType" }),
            ]);

          const deadline = Number(dl);
          const winnersCount = Number(winC);
          const maxWinners = Number(maxW);
          const now = Math.floor(Date.now() / 1000);
          let status: BountyMeta["status"] = "active";
          if (winnersCount >= maxWinners) status = "filled";
          else if (deadline < now) status = "expired";

          results.push({
            id: i,
            address: bountyAddr,
            creator: creator as `0x${string}`,
            titleHash: "0x",
            specURI: "",
            rewardToken: rewardToken as `0x${string}`,
            rewardAmount: remaining as bigint,
            payoutPerWinner: payout as bigint,
            maxWinners,
            winnersCount,
            deadline,
            proofType: pt as ProofType,
            status,
          });
        } catch {
          // skip broken entries
        }
      }

      setBounties(results.reverse()); // newest first
      setLoading(false);
    }

    load();
  }, [publicClient, bountyCount]);

  // Filter bounties by category
  const filtered = bounties.filter((b) => {
    if (activeCategory === "all") return true;
    if (activeCategory === "social") return b.proofType === ProofType.EAS_ATTESTATION;
    if (activeCategory === "onchain") return b.proofType === ProofType.TX_EVENT;
    if (activeCategory === "active") return b.status === "active";
    return true;
  });

  return (
    <main className="min-h-screen px-4 py-6 max-w-lg mx-auto pb-24">
      {/* Hero */}
      <div className="mb-6">
        <p className="text-sm text-gray-400">
          Onchain bounties, verified and paid
        </p>
      </div>

      {/* Post bounty CTA */}
      <Link
        href="/create"
        className="flex items-center justify-center gap-2 w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3.5 rounded-xl mb-8 transition-colors"
      >
        <span className="text-lg">+</span> Post a Bounty
      </Link>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-4 py-1.5 text-sm rounded-full transition-colors whitespace-nowrap ${
              activeCategory === cat.key
                ? "bg-brand-600 text-white"
                : "bg-white/10 hover:bg-white/15 text-gray-400"
            }`}
          >
            {cat.label}
            {cat.key !== "all" && !loading && (
              <span className="ml-1.5 text-xs opacity-60">
                {bounties.filter((b) => {
                  if (cat.key === "social") return b.proofType === ProofType.EAS_ATTESTATION;
                  if (cat.key === "onchain") return b.proofType === ProofType.TX_EVENT;
                  if (cat.key === "active") return b.status === "active";
                  return true;
                }).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bounty list */}
      <section className="space-y-3">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-white/10 p-4 animate-pulse">
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <div className="h-3 w-20 bg-white/10 rounded" />
                    <div className="h-4 w-32 bg-white/10 rounded" />
                  </div>
                  <div className="h-5 w-16 bg-white/10 rounded" />
                </div>
                <div className="h-3 w-24 bg-white/10 rounded mt-3" />
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
            {bounties.length === 0 ? (
              <>
                <p className="text-gray-400 mb-2">No bounties yet</p>
                <p className="text-gray-500 text-sm">Be the first to post one!</p>
              </>
            ) : (
              <>
                <p className="text-gray-400 mb-2">No {activeCategory} bounties</p>
                <button
                  onClick={() => setActiveCategory("all")}
                  className="text-brand-400 text-sm hover:underline"
                >
                  Show all bounties
                </button>
              </>
            )}
          </div>
        )}

        {!loading && filtered.map((b) => <BountyCard key={b.id} bounty={b} />)}
      </section>
    </main>
  );
}
