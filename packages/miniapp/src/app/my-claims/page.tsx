"use client";

import { useAccount, useReadContract } from "wagmi";
import { FACTORY_ABI, FACTORY_ADDRESS, BOUNTY_ABI } from "@/config/contracts";
import { formatReward, shortenAddress, timeLeft } from "@/lib/format";
import Link from "next/link";
import { type Address } from "viem";
import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";

interface ClaimedBounty {
  id: number;
  address: Address;
  payout: bigint;
  deadline: number;
}

export default function MyClaimsPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const { data: bountyCount } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "bountyCount",
  });

  const [claims, setClaims] = useState<ClaimedBounty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicClient || !address || bountyCount === undefined) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      const results: ClaimedBounty[] = [];
      const count = Number(bountyCount);

      for (let i = 0; i < count; i++) {
        try {
          const bountyAddr = (await publicClient!.readContract({
            address: FACTORY_ADDRESS,
            abi: FACTORY_ABI,
            functionName: "bounties",
            args: [BigInt(i)],
          })) as Address;

          const didClaim = (await publicClient!.readContract({
            address: bountyAddr,
            abi: BOUNTY_ABI,
            functionName: "claimed",
            args: [address!],
          })) as boolean;

          if (!didClaim) continue;

          const [payout, dl] = await Promise.all([
            publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "payoutPerWinner" }),
            publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "deadline" }),
          ]);

          results.push({
            id: i,
            address: bountyAddr,
            payout: payout as bigint,
            deadline: Number(dl),
          });
        } catch {
          // skip broken entries
        }
      }

      setClaims(results);
      setLoading(false);
    }

    load();
  }, [publicClient, address, bountyCount]);

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-6">My Claims</h1>

      {!isConnected && (
        <p className="text-gray-500">Connect your wallet to see your claims.</p>
      )}

      {isConnected && loading && (
        <p className="text-gray-500">Loading...</p>
      )}

      {isConnected && !loading && claims.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">You haven't claimed any bounties yet.</p>
          <Link href="/" className="text-brand-400 underline text-sm">
            Browse bounties
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {claims.map((c) => (
          <Link
            key={c.id}
            href={`/bounties/${c.id}`}
            className="block rounded-xl border border-white/10 hover:border-brand-500/40 p-4 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">Bounty #{c.id}</p>
                <p className="text-xs text-gray-500 font-mono">{shortenAddress(c.address)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-400">
                  +{formatReward(c.payout)} ETH
                </p>
                <p className="text-xs text-gray-500">claimed</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur border-t border-white/10 px-4 py-3">
        <div className="max-w-lg mx-auto flex justify-around text-xs text-gray-400">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <Link href="/my-bounties" className="hover:text-white transition">My Bounties</Link>
          <Link href="/my-claims" className="text-white font-medium">My Claims</Link>
        </div>
      </nav>
    </main>
  );
}
