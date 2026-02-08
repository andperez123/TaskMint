"use client";

import Link from "next/link";
import { useReadContract, usePublicClient } from "wagmi";
import { useEffect, useState } from "react";
import { type Address } from "viem";
import { FACTORY_ABI, FACTORY_ADDRESS, BOUNTY_ABI } from "@/config/contracts";
import { BountyCard } from "@/components/BountyCard";
import { type BountyMeta, type ProofType } from "@/lib/types";

const CATEGORIES = ["All", "Onchain", "Social", "Testing"] as const;

export default function Home() {
  const publicClient = usePublicClient();
  const [activeCategory, setActiveCategory] = useState<string>("All");

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

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto pb-24">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Taskmint</h1>
        <p className="text-sm text-gray-400 mt-1">
          Onchain bounties, verified and paid
        </p>
      </header>

      {/* Post bounty CTA */}
      <Link
        href="/create"
        className="block w-full text-center bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-xl mb-8 transition-colors"
      >
        + Post a Bounty
      </Link>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
              activeCategory === cat
                ? "bg-brand-600 text-white"
                : "bg-white/10 hover:bg-white/20 text-gray-300"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Bounty list */}
      <section className="space-y-3">
        {loading && <p className="text-gray-500 text-sm text-center py-8">Loading bounties...</p>}

        {!loading && bounties.length === 0 && (
          <div className="rounded-xl border border-white/10 p-4">
            <p className="text-gray-500 text-sm text-center py-8">
              No bounties yet. Be the first to post one!
            </p>
          </div>
        )}

        {!loading &&
          bounties.map((b) => <BountyCard key={b.id} bounty={b} />)}
      </section>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur border-t border-white/10 px-4 py-3">
        <div className="max-w-lg mx-auto flex justify-around text-xs text-gray-400">
          <Link href="/" className="text-white font-medium">
            Home
          </Link>
          <Link href="/my-bounties" className="hover:text-white transition">
            My Bounties
          </Link>
          <Link href="/my-claims" className="hover:text-white transition">
            My Claims
          </Link>
        </div>
      </nav>
    </main>
  );
}
