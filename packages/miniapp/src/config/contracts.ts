import { type Address } from "viem";

// -- Base Sepolia deployment addresses --
// Update these after running the deploy script.

export const FACTORY_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as Address) ??
  "0x0000000000000000000000000000000000000000";

export const ROUTER_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_ROUTER_ADDRESS as Address) ??
  "0x0000000000000000000000000000000000000000";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");

// -- ABIs (minimal, enough for the frontend) --

export const FACTORY_ABI = [
  {
    name: "createBounty",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "titleHash", type: "bytes32" },
          { name: "specURI", type: "string" },
          { name: "rewardToken", type: "address" },
          { name: "rewardAmount", type: "uint256" },
          { name: "payoutPerWinner", type: "uint256" },
          { name: "maxWinners", type: "uint16" },
          { name: "deadline", type: "uint64" },
          { name: "proofType", type: "uint8" },
          { name: "verificationData", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "bountyAddress", type: "address" }],
  },
  {
    name: "bountyCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "bounties",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const BOUNTY_ABI = [
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "proof", type: "bytes" }],
    outputs: [],
  },
  {
    name: "withdrawUnclaimed",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "creator",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "rewardToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "remainingReward",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "payoutPerWinner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "maxWinners",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    name: "winnersCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    name: "deadline",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    name: "proofType",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "claimed",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const ROUTER_ABI = [
  {
    name: "executeTask",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "bounty", type: "address" },
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "completions",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
