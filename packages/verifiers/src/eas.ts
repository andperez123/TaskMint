import {
  createWalletClient,
  createPublicClient,
  http,
  encodePacked,
  encodeAbiParameters,
  parseAbiParameters,
  type Address,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// EAS contract ABI (only what we need)
const EAS_ABI = [
  {
    name: "attest",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "schema", type: "bytes32" },
          {
            name: "data",
            type: "tuple",
            components: [
              { name: "recipient", type: "address" },
              { name: "expirationTime", type: "uint64" },
              { name: "revocable", type: "bool" },
              { name: "refUID", type: "bytes32" },
              { name: "data", type: "bytes" },
              { name: "value", type: "uint256" },
            ],
          },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const EAS_ADDRESS = (process.env.EAS_CONTRACT ??
  "0x4200000000000000000000000000000000000021") as Address;

export interface SocialAttestationData {
  bountyAddress: Address;
  executorWallet: Address;
  fid: bigint;
  castHash: Hex;
  actionType: string;
  timestamp: bigint;
}

/**
 * Submit an EAS attestation for a verified social action.
 * Returns the attestation UID.
 */
export async function submitSocialAttestation(
  schemaUID: Hex,
  data: SocialAttestationData
): Promise<Hex> {
  const pk = process.env.VERIFIER_PRIVATE_KEY;
  if (!pk) throw new Error("VERIFIER_PRIVATE_KEY not set");

  const account = privateKeyToAccount(pk as Hex);

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.RPC_URL),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.RPC_URL),
  });

  // Encode attestation data matching the schema:
  // "address bountyAddress,address executorWallet,uint256 fid,bytes32 castHash,string actionType,uint256 timestamp"
  const encodedData = encodeAbiParameters(
    parseAbiParameters(
      "address bountyAddress, address executorWallet, uint256 fid, bytes32 castHash, string actionType, uint256 timestamp"
    ),
    [
      data.bountyAddress,
      data.executorWallet,
      data.fid,
      data.castHash,
      data.actionType,
      data.timestamp,
    ]
  );

  // Submit attestation
  const txHash = await walletClient.writeContract({
    address: EAS_ADDRESS,
    abi: EAS_ABI,
    functionName: "attest",
    args: [
      {
        schema: schemaUID,
        data: {
          recipient: data.executorWallet,
          expirationTime: 0n, // no expiration
          revocable: true,
          refUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
          data: encodedData,
          value: 0n,
        },
      },
    ],
  });

  console.log(`[eas] attestation tx: ${txHash}`);

  // Wait for receipt and extract attestation UID from logs
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  // The EAS contract emits Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaId)
  // The UID is in the event data
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === EAS_ADDRESS.toLowerCase() && log.topics.length >= 4) {
      // uid is the 3rd topic (index 2) — no, actually in EAS the uid is in data or topics
      // EAS Attested event: topics[0]=sig, topics[1]=recipient, topics[2]=attester, topics[3]=schemaId
      // data contains the uid as first 32 bytes
      if (log.data && log.data.length >= 66) {
        const uid = ("0x" + log.data.slice(2, 66)) as Hex;
        console.log(`[eas] attestation UID: ${uid}`);
        return uid;
      }
    }
  }

  throw new Error("Could not extract attestation UID from receipt");
}
