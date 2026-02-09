import type { Request, Response } from "express";
import { type Address, type Hex, keccak256, toBytes } from "viem";
import { submitSocialAttestation } from "./eas.js";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY ?? "";
const SOCIAL_SCHEMA_UID = process.env.SOCIAL_SCHEMA_UID as Hex;
const NEYNAR_BASE = "https://api.neynar.com/v2/farcaster";

interface SocialAttestRequest {
  bountyId: string;       // bounty contract address
  executorWallet: string; // executor's wallet
  fid: number;            // Farcaster FID
  castHash: string;       // target cast hash
  actionType: "like" | "recast" | "reply";
}

/**
 * POST /proof/social/attest
 *
 * 1. Checks that the FID performed the action on the cast via Neynar (or mock mode).
 * 2. Submits an EAS attestation on Base with the verified data.
 * 3. Returns the attestation UID for the executor to use in claim().
 */
export async function handleSocialAttest(req: Request, res: Response) {
  try {
    const body = req.body as SocialAttestRequest;
    const { bountyId, executorWallet, fid, castHash, actionType } = body;

    if (!bountyId || !executorWallet || !fid || !castHash || !actionType) {
      return res.status(400).json({ error: "Missing required fields: bountyId, executorWallet, fid, castHash, actionType" });
    }

    if (!SOCIAL_SCHEMA_UID) {
      return res.status(500).json({ error: "SOCIAL_SCHEMA_UID not configured" });
    }

    // Step 1: Verify the social action
    if (NEYNAR_API_KEY) {
      // Real verification via Neynar
      const verified = await verifySocialAction(fid, castHash, actionType);
      if (!verified) {
        return res.status(400).json({ error: `Social action '${actionType}' not found for FID ${fid} on cast ${castHash}` });
      }
      console.log(`[social-verifier] Neynar verified: ${actionType} by FID ${fid} on ${castHash}`);
    } else {
      // Mock mode — skip Neynar check, just attest
      console.log(`[social-verifier] MOCK MODE (no NEYNAR_API_KEY): skipping verification, attesting directly`);
    }

    // Step 2: Submit EAS attestation
    // Always hash the castHash to get a proper bytes32
    const castHashBytes = keccak256(toBytes(castHash));

    const attestationUID = await submitSocialAttestation(SOCIAL_SCHEMA_UID, {
      bountyAddress: bountyId as Address,
      executorWallet: executorWallet as Address,
      fid: BigInt(fid),
      castHash: castHashBytes as Hex,
      actionType,
      timestamp: BigInt(Math.floor(Date.now() / 1000)),
    });

    console.log(`[social-verifier] Attestation submitted: ${attestationUID}`);

    return res.json({
      ok: true,
      attestationUID,
      bountyId,
      executorWallet,
      fid,
      castHash,
      actionType,
    });
  } catch (err: any) {
    console.error("[social-verifier] error:", err?.message ?? err);
    return res.status(500).json({ error: err?.message ?? "Internal error" });
  }
}

async function verifySocialAction(
  fid: number,
  castHash: string,
  actionType: "like" | "recast" | "reply"
): Promise<boolean> {
  try {
    if (actionType === "like" || actionType === "recast") {
      const reactionType = actionType === "like" ? "likes" : "recasts";
      const url = `${NEYNAR_BASE}/reactions/cast?hash=${castHash}&types=${reactionType}&limit=100`;
      const resp = await fetch(url, {
        headers: { accept: "application/json", api_key: NEYNAR_API_KEY },
      });

      if (!resp.ok) {
        console.error(`[social-verifier] Neynar returned ${resp.status}`);
        return false;
      }

      const data = await resp.json();
      const reactions = data.reactions ?? [];
      return reactions.some((r: any) => r.user?.fid === fid);
    }

    if (actionType === "reply") {
      const url = `${NEYNAR_BASE}/cast?identifier=${castHash}&type=hash`;
      const resp = await fetch(url, {
        headers: { accept: "application/json", api_key: NEYNAR_API_KEY },
      });

      if (!resp.ok) return false;

      const data = await resp.json();
      const replies = data.cast?.replies?.casts ?? [];
      return replies.some((r: any) => r.author?.fid === fid);
    }

    return false;
  } catch (err) {
    console.error("[social-verifier] Neynar API error:", err);
    return false;
  }
}
