// -- Shared frontend types --

export enum ProofType {
  TX_EVENT = 0,
  STATE_PREDICATE = 1,
  EAS_ATTESTATION = 2,
}

export const PROOF_TYPE_LABELS: Record<ProofType, string> = {
  [ProofType.TX_EVENT]: "Onchain Task",
  [ProofType.STATE_PREDICATE]: "State Check",
  [ProofType.EAS_ATTESTATION]: "Social Engagement",
};

export const CATEGORY_LABELS = ["Onchain", "Social", "Testing"] as const;

export interface BountyMeta {
  id: number;
  address: `0x${string}`;
  creator: `0x${string}`;
  titleHash: `0x${string}`;
  specURI: string;
  rewardToken: `0x${string}`;
  rewardAmount: bigint;
  payoutPerWinner: bigint;
  maxWinners: number;
  winnersCount: number;
  deadline: number; // unix seconds
  proofType: ProofType;
  status: "active" | "filled" | "expired" | "cancelled";
}
