import { createPublicClient, http, parseAbiItem, type Address, type PublicClient } from "viem";
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
const MAX_BLOCK_RANGE = 10n;    // Alchemy free tier limit

export function startSync(db: Database.Database, factoryAddress: Address, startBlock: bigint | "latest") {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.RPC_URL),
  });

  let resolvedStartBlock: bigint | null = startBlock === "latest" ? null : startBlock;

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
  const getBountyCount = db.prepare(`SELECT COUNT(*) as cnt FROM bounties`);

  /** Fetch logs in chunks of MAX_BLOCK_RANGE to stay within RPC limits */
  async function getLogsChunked<T>(
    params: {
      address?: Address;
      event: any;
      fromBlock: bigint;
      toBlock: bigint;
    }
  ) {
    const allLogs: any[] = [];
    let cursor = params.fromBlock;

    while (cursor <= params.toBlock) {
      const chunkEnd = cursor + MAX_BLOCK_RANGE - 1n > params.toBlock
        ? params.toBlock
        : cursor + MAX_BLOCK_RANGE - 1n;

      const logs = await client.getLogs({
        address: params.address,
        event: params.event,
        fromBlock: cursor,
        toBlock: chunkEnd,
      });

      allLogs.push(...logs);
      cursor = chunkEnd + 1n;
    }

    return allLogs;
  }

  async function poll() {
    try {
      const latestBlock = await client.getBlockNumber();

      // On first run with "latest", start from the current block
      if (resolvedStartBlock === null) {
        resolvedStartBlock = latestBlock;
        console.log(`[sync] resolved start block to latest: ${latestBlock}`);
      }

      const row = getLastBlock.get() as { value: string } | undefined;
      const fromBlock = row ? BigInt(row.value) + 1n : resolvedStartBlock;

      if (fromBlock > latestBlock) return;

      // Fetch BountyCreated logs (chunked)
      const createdLogs = await getLogsChunked({
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

      // Fetch BountyClaimed logs (chunked, no address filter since bounties are clones)
      const claimedLogs = await getLogsChunked({
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

      // Fetch BountyWithdrawn logs (chunked)
      const withdrawnLogs = await getLogsChunked({
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
      } else {
        console.log(`[sync] block ${fromBlock}-${latestBlock}: up to date`);
      }
    } catch (err: any) {
      console.error("[sync] error:", err?.shortMessage ?? err?.message ?? err);
    }
  }

  // Start polling
  console.log(`[sync] starting from block ${startBlock}, polling every ${POLL_INTERVAL_MS}ms`);
  setInterval(poll, POLL_INTERVAL_MS);
  poll(); // run immediately
}
