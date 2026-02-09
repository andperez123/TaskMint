"use client";

import { useAccount, useReadContract, usePublicClient } from "wagmi";
import { FACTORY_ABI, FACTORY_ADDRESS, BOUNTY_ABI } from "@/config/contracts";
import { formatReward, shortenAddress, timeLeft } from "@/lib/format";
import Link from "next/link";
import { type Address } from "viem";
import { useEffect, useState } from "react";

interface MyBounty {
  id: number;
  address: Address;
  remaining: bigint;
  payout: bigint;
  maxWinners: number;
  winnersCount: number;
  deadline: number;
  proofType: number;
}

export default function MyBountiesPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const { data: bountyCount } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "bountyCount",
  });

  const [myBounties, setMyBounties] = useState<MyBounty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicClient || !address || bountyCount === undefined) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      const results: MyBounty[] = [];
      const count = Number(bountyCount);

      for (let i = 0; i < count; i++) {
        try {
          const bountyAddr = (await publicClient!.readContract({
            address: FACTORY_ADDRESS,
            abi: FACTORY_ABI,
            functionName: "bounties",
            args: [BigInt(i)],
          })) as Address;

          const creator = (await publicClient!.readContract({
            address: bountyAddr,
            abi: BOUNTY_ABI,
            functionName: "creator",
          })) as Address;

          if (creator.toLowerCase() !== address!.toLowerCase()) continue;

          const [remaining, payout, maxW, winC, dl, pt] = await Promise.all([
            publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "remainingReward" }),
            publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "payoutPerWinner" }),
            publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "maxWinners" }),
            publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "winnersCount" }),
            publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "deadline" }),
            publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "proofType" }),
          ]);

          results.push({
            id: i,
            address: bountyAddr,
            remaining: remaining as bigint,
            payout: payout as bigint,
            maxWinners: Number(maxW),
            winnersCount: Number(winC),
            deadline: Number(dl),
            proofType: Number(pt),
          });
        } catch {
          // skip
        }
      }

      setMyBounties(results.reverse());
      setLoading(false);
    }

    load();
  }, [publicClient, address, bountyCount]);

  return (
    <main className="min-h-screen px-4 py-6 max-w-lg mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-6">My Bounties</h1>

      {!isConnected && (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-2">Connect your wallet to see your bounties.</p>
          <p className="text-sm text-gray-500">Use the button in the top right.</p>
        </div>
      )}

      {isConnected && loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-white/10 p-4 animate-pulse">
              <div className="h-4 w-32 bg-white/10 rounded mb-2" />
              <div className="h-3 w-24 bg-white/10 rounded" />
            </div>
          ))}
        </div>
      )}

      {isConnected && !loading && myBounties.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-3">You haven&apos;t created any bounties yet.</p>
          <Link
            href="/create"
            className="inline-block bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            Create your first bounty
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {myBounties.map((b) => {
          const expired = b.deadline * 1000 < Date.now();
          const filled = b.winnersCount >= b.maxWinners;
          const isSocial = b.proofType === 2;
          return (
            <Link
              key={b.id}
              href={`/bounties/${b.id}`}
              className="block rounded-xl border border-white/10 hover:border-brand-500/40 p-4 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {isSocial ? (
                      <span className="text-[10px] font-medium bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">Social</span>
                    ) : (
                      <span className="text-[10px] font-medium bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Onchain</span>
                    )}
                    {!expired && !filled && <span className="text-[10px] font-medium bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">Active</span>}
                    {expired && <span className="text-[10px] font-medium bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">Expired</span>}
                    {filled && <span className="text-[10px] font-medium bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">Filled</span>}
                  </div>
                  <p className="font-semibold">Bounty #{b.id}</p>
                  <p className="text-xs text-gray-500 font-mono">{shortenAddress(b.address)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-brand-400">
                    {formatReward(b.remaining)} ETH
                  </p>
                  <p className="text-xs text-gray-500">
                    {b.winnersCount}/{b.maxWinners} claimed
                  </p>
                </div>
              </div>
              <p className={`text-xs mt-2 ${expired ? "text-gray-500" : "text-gray-400"}`}>
                {timeLeft(b.deadline)}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
