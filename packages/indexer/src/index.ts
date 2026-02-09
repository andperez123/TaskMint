import "dotenv/config";

import { getDb, migrate } from "./db/schema.js";
import { startSync } from "./sync.js";
import { createApi } from "./api.js";
import { type Address } from "viem";

// -- Config from env --
if (!process.env.RPC_URL) {
  console.error("ERROR: RPC_URL is required. Set it in .env (e.g. https://base-sepolia.g.alchemy.com/v2/YOUR_KEY)");
  process.exit(1);
}

const rawFactory = (process.env.FACTORY_ADDRESS ?? "").trim();
const FACTORY_ADDRESS = (rawFactory || "0x0000000000000000000000000000000000000000") as Address;
// Default to "latest" — contracts aren't deployed yet so scanning from 0 is wasteful.
// Set START_BLOCK in .env to your factory deployment block once deployed.
const rawStartBlock = (process.env.START_BLOCK ?? "").trim();
const START_BLOCK: bigint | "latest" = rawStartBlock && rawStartBlock !== "0"
  ? BigInt(rawStartBlock)
  : "latest";
const PORT = Number(process.env.PORT ?? "4000");

// -- Init --
const db = getDb();
migrate(db);

console.log("Taskmint Indexer starting...");
console.log(`  rpc: ${process.env.RPC_URL}`);
console.log(`  factory: ${FACTORY_ADDRESS}`);
console.log(`  start block: ${START_BLOCK}`);
console.log(`  port: ${PORT}`);

// Start event sync (only if factory is deployed)
if (!rawFactory) {
  console.warn("[sync] FACTORY_ADDRESS not set — event sync disabled. API still running.");
  console.warn("[sync] Deploy contracts and set FACTORY_ADDRESS in .env to enable sync.");
} else {
  startSync(db, FACTORY_ADDRESS, START_BLOCK);
}

// Start API server
createApi(db, PORT);
