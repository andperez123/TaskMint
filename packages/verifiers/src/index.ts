import "dotenv/config";

import express from "express";
import cors from "cors";
import { handleSocialAttest } from "./social-verifier.js";
import { handleTestAttest } from "./test-verifier.js";

const PORT = Number(process.env.PORT ?? "4001");

const app = express();
app.use(cors());
app.use(express.json());

// -- Social verifier --
app.post("/proof/social/attest", handleSocialAttest);

// -- Test verifier (Phase 3) --
app.post("/proof/test/attest", handleTestAttest);

// -- Health --
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`[verifiers] listening on http://localhost:${PORT}`);
  console.log(`  schema: ${process.env.SOCIAL_SCHEMA_UID ?? "NOT SET"}`);
  console.log(`  neynar: ${process.env.NEYNAR_API_KEY ? "configured" : "MOCK MODE (no key)"}`);
  console.log(`  eas: ${process.env.EAS_CONTRACT ?? "default"}`);
});
