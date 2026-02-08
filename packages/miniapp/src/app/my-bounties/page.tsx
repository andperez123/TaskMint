"use client";

import { useAccount, useReadContract } from "wagmi";
import { FACTORY_ABI, FACTORY_ADDRESS, BOUNTY_ABI } from "@/config/contracts";
import { formatReward, shortenAddress, timeLeft } from "@/lib/format";
import Link from "next/link";
import { type Address } from "viem";
import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";

interface MyBounty {
  id: number;
  address: Address;
  remaining: bigint;
  maxWinners: number;
  winnersCount: number;
  deadline: number;
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

          const [remaining, maxW, winC, dl] = await Promise.all([
            publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "remainingReward" }),
            publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "maxWinners" }),
            publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "winnersCount" }),
            publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "deadline" }),
          ]);

          results.push({
            id: i,
            address: bountyAddr,
            remaining: remaining as bigint,
            maxWinners: Number(maxW),
            winnersCount: Number(winC),
            deadline: Number(dl),
          });
        } catch {
          // skip broken entries
        }
      }

      setMyBounties(results);
      setLoading(false);
    }

    load();
  }, [publicClient, address, bountyCount]);

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-6">My Bounties</h1>

      {!isConnected && (
        <p className="text-gray-500">Connect your wallet to see your bounties.</p>
      )}

      {isConnected && loading && (
        <p className="text-gray-500">Loading...</p>
      )}

      {isConnected && !loading && myBounties.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">You haven't created any bounties yet.</p>
          <Link href="/create" className="text-brand-400 underline text-sm">
            Create your first bounty
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {myBounties.map((b) => {
          const expired = b.deadline * 1000 < Date.now();
          return (
            <Link
              key={b.id}
              href={`/bounties/${b.id}`}
              className="block rounded-xl border border-white/10 hover:border-brand-500/40 p-4 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
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
              <p className={`text-xs mt-2 ${expired ? "text-red-400" : "text-green-400"}`}>
                {timeLeft(b.deadline)}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur border-t border-white/10 px-4 py-3">
        <div className="max-w-lg mx-auto flex justify-around text-xs text-gray-400">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <Link href="/my-bounties" className="text-white font-medium">My Bounties</Link>
          <Link href="/my-claims" className="hover:text-white transition">My Claims</Link>
        </div>
      </nav>
    </main>
  );
}
