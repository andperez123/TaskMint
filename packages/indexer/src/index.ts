import { getDb, migrate } from "./db/schema.js";
import { startSync } from "./sync.js";
import { createApi } from "./api.js";
import { type Address } from "viem";

// -- Config from env --
const FACTORY_ADDRESS = (process.env.FACTORY_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address;
const START_BLOCK = BigInt(process.env.START_BLOCK ?? "0");
const PORT = Number(process.env.PORT ?? "4000");

// -- Init --
const db = getDb();
migrate(db);

console.log("Taskmint Indexer starting...");
console.log(`  factory: ${FACTORY_ADDRESS}`);
console.log(`  start block: ${START_BLOCK}`);
console.log(`  port: ${PORT}`);

// Start event sync
startSync(db, FACTORY_ADDRESS, START_BLOCK);

// Start API server
createApi(db, PORT);
