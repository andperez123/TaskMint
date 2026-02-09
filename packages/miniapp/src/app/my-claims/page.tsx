"use client";

import { useAccount, useReadContract, usePublicClient } from "wagmi";
import { FACTORY_ABI, FACTORY_ADDRESS, BOUNTY_ABI } from "@/config/contracts";
import { formatReward, shortenAddress } from "@/lib/format";
import Link from "next/link";
import { type Address } from "viem";
import { useEffect, useState } from "react";

interface ClaimedBounty {
  id: number;
  address: Address;
  payout: bigint;
  proofType: number;
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

  // Sum total earned
  const totalEarned = claims.reduce((sum, c) => sum + c.payout, 0n);

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

          const [payout, pt] = await Promise.all([
            publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "payoutPerWinner" }),
            publicClient!.readContract({ address: bountyAddr, abi: BOUNTY_ABI, functionName: "proofType" }),
          ]);

          results.push({
            id: i,
            address: bountyAddr,
            payout: payout as bigint,
            proofType: Number(pt),
          });
        } catch {
          // skip
        }
      }

      setClaims(results.reverse());
      setLoading(false);
    }

    load();
  }, [publicClient, address, bountyCount]);

  return (
    <main className="min-h-screen px-4 py-6 max-w-lg mx-auto pb-24">
      <h1 className="text-2xl font-bold mb-6">My Claims</h1>

      {!isConnected && (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-2">Connect your wallet to see your claims.</p>
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

      {isConnected && !loading && claims.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-3">You haven&apos;t claimed any bounties yet.</p>
          <Link
            href="/"
            className="inline-block bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
          >
            Browse bounties
          </Link>
        </div>
      )}

      {/* Total earned banner */}
      {claims.length > 0 && (
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 mb-6 text-center">
          <p className="text-xs text-green-400/70 mb-1">Total Earned</p>
          <p className="text-2xl font-bold text-green-400">{formatReward(totalEarned)} ETH</p>
          <p className="text-xs text-gray-500 mt-1">from {claims.length} bounties</p>
        </div>
      )}

      <div className="space-y-3">
        {claims.map((c) => {
          const isSocial = c.proofType === 2;
          return (
            <Link
              key={c.id}
              href={`/bounties/${c.id}`}
              className="block rounded-xl border border-white/10 hover:border-brand-500/40 p-4 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {isSocial ? (
                      <span className="text-[10px] font-medium bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">Social</span>
                    ) : (
                      <span className="text-[10px] font-medium bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Onchain</span>
                    )}
                    <span className="text-[10px] font-medium bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">Claimed</span>
                  </div>
                  <p className="font-semibold">Bounty #{c.id}</p>
                  <p className="text-xs text-gray-500 font-mono">{shortenAddress(c.address)}</p>
                </div>
                <p className="font-bold text-green-400 text-lg">
                  +{formatReward(c.payout)} ETH
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
