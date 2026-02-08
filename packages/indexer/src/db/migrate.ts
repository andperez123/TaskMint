import { getDb, migrate } from "./schema.js";

const db = getDb();
migrate(db);
console.log("Migration complete.");
db.close();
