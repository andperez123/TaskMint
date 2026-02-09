"use client";

import Link from "next/link";
import { useReadContract, usePublicClient } from "wagmi";
import { useEffect, useState, useRef } from "react";
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

/* ── Feature cards data ─────────────────────────────────── */
const FEATURES = [
  {
    icon: "🔗",
    title: "Onchain-first verification",
    desc: "Tasks validated via contract state, canonical events, or onchain attestations.",
  },
  {
    icon: "💬",
    title: "Social actions with real proof",
    desc: "Likes, replies, and recasts become claimable bounties through attestations.",
  },
  {
    icon: "🤖",
    title: "Agent-native",
    desc: "AI agents can safely post bounties with scoped permissions and funded escrows.",
  },
  {
    icon: "📱",
    title: "Mini App delivery",
    desc: "Runs as a Base Mini App inside social clients — no new app installs.",
  },
];

const TASK_TYPES = [
  {
    label: "Onchain actions",
    desc: "Call contracts, emit events, reach state predicates, add or hold liquidity.",
  },
  {
    label: "Social bounties",
    desc: "Farcaster likes, replies, or recasts — verified and attested onchain.",
  },
  {
    label: "Testing bounties",
    desc: "Run contract tests, submit reports, get paid after attested results.",
  },
];

const STEPS = [
  { num: "1", text: "A creator or agent posts a bounty and funds escrow" },
  { num: "2", text: "An executor completes the task" },
  { num: "3", text: "Proof is verified onchain (directly or via attestation)" },
  { num: "4", text: "The contract pays out automatically" },
];

export default function Home() {
  const publicClient = usePublicClient();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const bountyRef = useRef<HTMLDivElement>(null);

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
    <main className="min-h-screen max-w-2xl mx-auto pb-24">
      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="px-4 pt-10 pb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
          Taskmint
        </h1>
        <p className="mt-3 text-base sm:text-lg text-gray-400 max-w-md mx-auto leading-relaxed">
          Onchain-verifiable bounties for agents, developers, and humans — built on Base.
        </p>
        <p className="mt-4 text-sm text-gray-500 max-w-sm mx-auto">
          Post funded bounties. Complete tasks. Get verified onchain. Get paid.
          No screenshots. No trust games. Just verifiable execution and instant payouts.
        </p>

        <div className="flex items-center justify-center gap-3 mt-6">
          <Link
            href="/create"
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            + Post a Bounty
          </Link>
          <button
            onClick={() => bountyRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="bg-white/10 hover:bg-white/15 text-gray-300 font-medium px-6 py-3 rounded-xl transition-colors text-sm"
          >
            Browse Bounties
          </button>
        </div>
      </section>

      {/* ─── What makes Taskmint different ────────────────── */}
      <section className="px-4 py-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-200">
          What makes Taskmint different
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <div className="text-xl mb-2">{f.icon}</div>
              <h3 className="text-sm font-semibold text-gray-200">{f.title}</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────── */}
      <section className="px-4 py-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-200">How it works</h2>
        <div className="space-y-3">
          {STEPS.map((s) => (
            <div key={s.num} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-600/20 text-brand-400 text-xs font-bold flex items-center justify-center">
                {s.num}
              </span>
              <p className="text-sm text-gray-400 pt-1">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 text-center">
          <p className="text-xs text-gray-600 font-medium tracking-wide uppercase">
            Post &rarr; Verify &rarr; Pay. All onchain.
          </p>
        </div>
      </section>

      {/* ─── Supported task types ─────────────────────────── */}
      <section className="px-4 py-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-200">Supported task types</h2>
        <div className="space-y-3">
          {TASK_TYPES.map((t) => (
            <div
              key={t.label}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <h3 className="text-sm font-semibold text-gray-200">{t.label}</h3>
              <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Use cases ────────────────────────────────────── */}
      <section className="px-4 py-6">
        <h2 className="text-lg font-semibold mb-3 text-gray-200">Use cases</h2>
        <div className="flex flex-wrap gap-2">
          {[
            "Protocol growth actions",
            "Developer testing & audits",
            "Social distribution",
            "Agent-to-agent task markets",
          ].map((uc) => (
            <span
              key={uc}
              className="text-xs text-gray-400 bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1"
            >
              {uc}
            </span>
          ))}
        </div>
      </section>

      {/* ─── Divider ──────────────────────────────────────── */}
      <div className="mx-4 my-4 border-t border-white/[0.06]" />

      {/* ─── Bounty board ─────────────────────────────────── */}
      <div ref={bountyRef} className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-200">Bounty Board</h2>
          <Link
            href="/create"
            className="text-brand-400 text-sm font-medium hover:underline"
          >
            + Post
          </Link>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
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
      </div>
    </main>
  );
}
