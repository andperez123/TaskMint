import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import type Database from "better-sqlite3";

// -- ABI event signatures --
const BountyCreatedEvent = parseAbiItem(
  "event BountyCreated(address indexed bountyAddress, address indexed creator, bytes32 titleHash, uint8 proofType, uint256 rewardAmount, uint64 deadline)"
);
const BountyClaimedEvent = parseAbiItem(
  "event BountyClaimed(address indexed bountyAddress, address indexed executor, uint256 payout)"
);
const BountyWithdrawnEvent = parseAbiItem(
  "event BountyWithdrawn(address indexed bountyAddress, address indexed creator, uint256 amount)"
);

const POLL_INTERVAL_MS = 5_000; // 5 seconds

export function startSync(db: Database.Database, factoryAddress: Address, startBlock: bigint) {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.RPC_URL ?? "https://sepolia.base.org"),
  });

  // Prepared statements
  const insertBounty = db.prepare(`
    INSERT OR IGNORE INTO bounties (id, address, creator, title_hash, proof_type, reward_amount, deadline, block_number, tx_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertClaim = db.prepare(`
    INSERT OR IGNORE INTO claims (bounty_address, executor, payout, block_number, tx_hash)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertWithdrawal = db.prepare(`
    INSERT OR IGNORE INTO withdrawals (bounty_address, creator, amount, block_number, tx_hash)
    VALUES (?, ?, ?, ?, ?)
  `);
  const getLastBlock = db.prepare(`SELECT value FROM sync_state WHERE key = 'last_block'`);
  const setLastBlock = db.prepare(`INSERT OR REPLACE INTO sync_state (key, value) VALUES ('last_block', ?)`);

  // Get the bounty count for ID assignment
  const getBountyCount = db.prepare(`SELECT COUNT(*) as cnt FROM bounties`);

  async function poll() {
    try {
      const row = getLastBlock.get() as { value: string } | undefined;
      const fromBlock = row ? BigInt(row.value) + 1n : startBlock;
      const latestBlock = await client.getBlockNumber();

      if (fromBlock > latestBlock) return;

      // Fetch BountyCreated logs
      const createdLogs = await client.getLogs({
        address: factoryAddress,
        event: BountyCreatedEvent,
        fromBlock,
        toBlock: latestBlock,
      });

      for (const log of createdLogs) {
        const { bountyAddress, creator, titleHash, proofType, rewardAmount, deadline } = log.args;
        const count = (getBountyCount.get() as { cnt: number }).cnt;
        insertBounty.run(
          count,
          bountyAddress!.toLowerCase(),
          creator!.toLowerCase(),
          titleHash,
          proofType,
          rewardAmount!.toString(),
          Number(deadline),
          Number(log.blockNumber),
          log.transactionHash
        );
      }

      // Fetch BountyClaimed logs (from all addresses since bounties are clones)
      const claimedLogs = await client.getLogs({
        event: BountyClaimedEvent,
        fromBlock,
        toBlock: latestBlock,
      });

      for (const log of claimedLogs) {
        const { bountyAddress, executor, payout } = log.args;
        insertClaim.run(
          bountyAddress!.toLowerCase(),
          executor!.toLowerCase(),
          payout!.toString(),
          Number(log.blockNumber),
          log.transactionHash
        );
      }

      // Fetch BountyWithdrawn logs
      const withdrawnLogs = await client.getLogs({
        event: BountyWithdrawnEvent,
        fromBlock,
        toBlock: latestBlock,
      });

      for (const log of withdrawnLogs) {
        const { bountyAddress, creator, amount } = log.args;
        insertWithdrawal.run(
          bountyAddress!.toLowerCase(),
          creator!.toLowerCase(),
          amount!.toString(),
          Number(log.blockNumber),
          log.transactionHash
        );
      }

      setLastBlock.run(latestBlock.toString());

      const total = createdLogs.length + claimedLogs.length + withdrawnLogs.length;
      if (total > 0) {
        console.log(
          `[sync] block ${fromBlock}-${latestBlock}: ${createdLogs.length} created, ${claimedLogs.length} claimed, ${withdrawnLogs.length} withdrawn`
        );
      }
    } catch (err) {
      console.error("[sync] error:", err);
    }
  }

  // Start polling
  console.log(`[sync] starting from block ${startBlock}, polling every ${POLL_INTERVAL_MS}ms`);
  setInterval(poll, POLL_INTERVAL_MS);
  poll(); // run immediately
}
