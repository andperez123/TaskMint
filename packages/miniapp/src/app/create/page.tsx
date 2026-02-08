"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, keccak256, toBytes, encodeAbiParameters, parseAbiParameters } from "viem";
import { FACTORY_ABI, FACTORY_ADDRESS, ROUTER_ADDRESS } from "@/config/contracts";
import { ProofType } from "@/lib/types";

export default function CreateBountyPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const [title, setTitle] = useState("");
  const [specURI, setSpecURI] = useState("");
  const [rewardEth, setRewardEth] = useState("");
  const [payoutEth, setPayoutEth] = useState("");
  const [maxWinners, setMaxWinners] = useState("1");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [proofType, setProofType] = useState<ProofType>(ProofType.TX_EVENT);

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  function buildVerificationData(): `0x${string}` {
    if (proofType === ProofType.TX_EVENT) {
      // Encode the router address
      return encodeAbiParameters(parseAbiParameters("address"), [ROUTER_ADDRESS]);
    }
    // STATE_PREDICATE and EAS_ATTESTATION need more complex encoding (Phase 2+)
    return "0x";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isConnected || !address) return;

    const rewardAmount = parseEther(rewardEth);
    const payoutPerWinner = parseEther(payoutEth);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(deadlineDays) * 86400);
    const titleHash = keccak256(toBytes(title));
    const verificationData = buildVerificationData();

    writeContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "createBounty",
      args: [
        {
          titleHash,
          specURI: specURI || "ipfs://TODO",
          rewardToken: "0x0000000000000000000000000000000000000000" as `0x${string}`,
          rewardAmount,
          payoutPerWinner,
          maxWinners: Number(maxWinners),
          deadline: deadline,
          proofType,
          verificationData,
        },
      ],
      value: rewardAmount,
    });
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto pb-24">
      <button onClick={() => router.back()} className="text-sm text-brand-400 mb-4">
        &larr; Back
      </button>

      <h1 className="text-2xl font-bold mb-6">Create a Bounty</h1>

      {!isConnected ? (
        <p className="text-gray-500">Connect your wallet to create a bounty.</p>
      ) : isSuccess ? (
        <div className="text-center py-12">
          <p className="text-green-400 font-semibold text-lg mb-2">Bounty created!</p>
          <p className="text-gray-400 text-sm mb-4 font-mono break-all">Tx: {txHash}</p>
          <button
            onClick={() => router.push("/")}
            className="text-brand-400 underline text-sm"
          >
            Back to Home
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <Field label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Add liquidity to USDC/ETH pool"
              className="input"
            />
          </Field>

          {/* Spec URI */}
          <Field label="Spec URI (IPFS / Arweave)">
            <input
              type="text"
              value={specURI}
              onChange={(e) => setSpecURI(e.target.value)}
              placeholder="ipfs://Qm..."
              className="input"
            />
          </Field>

          {/* Proof type */}
          <Field label="Proof Type">
            <select
              value={proofType}
              onChange={(e) => setProofType(Number(e.target.value) as ProofType)}
              className="input"
            >
              <option value={ProofType.TX_EVENT}>Onchain (Router)</option>
              <option value={ProofType.STATE_PREDICATE}>State Predicate</option>
              <option value={ProofType.EAS_ATTESTATION}>EAS Attestation</option>
            </select>
          </Field>

          {/* Reward */}
          <Field label="Total Reward (ETH)">
            <input
              type="number"
              step="0.001"
              min="0"
              value={rewardEth}
              onChange={(e) => setRewardEth(e.target.value)}
              required
              placeholder="1.0"
              className="input"
            />
          </Field>

          {/* Payout per winner */}
          <Field label="Payout per Winner (ETH)">
            <input
              type="number"
              step="0.001"
              min="0"
              value={payoutEth}
              onChange={(e) => setPayoutEth(e.target.value)}
              required
              placeholder="0.5"
              className="input"
            />
          </Field>

          {/* Max winners */}
          <Field label="Max Winners">
            <input
              type="number"
              min="1"
              value={maxWinners}
              onChange={(e) => setMaxWinners(e.target.value)}
              required
              className="input"
            />
          </Field>

          {/* Deadline */}
          <Field label="Deadline (days from now)">
            <input
              type="number"
              min="1"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
              required
              className="input"
            />
          </Field>

          {error && (
            <p className="text-red-400 text-sm">
              {(error as any)?.shortMessage ?? error.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || confirming}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {isPending || confirming ? "Creating..." : "Create & Fund Bounty"}
          </button>
        </form>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-gray-400 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
