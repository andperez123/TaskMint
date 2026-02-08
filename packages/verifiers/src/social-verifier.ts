import type { Request, Response } from "express";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY ?? "";
const NEYNAR_BASE = "https://api.neynar.com/v2/farcaster";

interface SocialAttestRequest {
  bountyId: string;      // bounty contract address
  executorWallet: string; // executor's wallet
  fid: number;           // Farcaster FID
  castHash: string;      // target cast hash
  actionType: "like" | "recast" | "reply";
}

/**
 * POST /proof/social/attest
 *
 * 1. Checks that the FID performed the action on the cast via Neynar.
 * 2. Submits an EAS attestation on Base with the verified data.
 * 3. Returns the attestation UID for the executor to use in claim().
 *
 * Phase 2 implementation — this is the skeleton.
 */
export async function handleSocialAttest(req: Request, res: Response) {
  try {
    const body = req.body as SocialAttestRequest;
    const { bountyId, executorWallet, fid, castHash, actionType } = body;

    if (!bountyId || !executorWallet || !fid || !castHash || !actionType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Step 1: Verify reaction via Neynar
    const verified = await verifySocialAction(fid, castHash, actionType);
    if (!verified) {
      return res.status(400).json({ error: "Social action not found or not verified" });
    }

    // Step 2: Submit EAS attestation
    // TODO (Phase 2): Use EAS SDK to create attestation with:
    //   schema: SOCIAL_SCHEMA_UID
    //   recipient: executorWallet
    //   data: abi.encode(bountyAddress, executorWallet, fid, castHash, actionType, timestamp)
    const attestationUID = "0x_TODO_ATTESTATION_UID";

    console.log(`[social-verifier] Verified ${actionType} by FID ${fid} on cast ${castHash}`);

    return res.json({
      ok: true,
      attestationUID,
      bountyId,
      executorWallet,
      fid,
      castHash,
      actionType,
    });
  } catch (err) {
    console.error("[social-verifier] error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

async function verifySocialAction(
  fid: number,
  castHash: string,
  actionType: "like" | "recast" | "reply"
): Promise<boolean> {
  if (!NEYNAR_API_KEY) {
    console.warn("[social-verifier] No NEYNAR_API_KEY set, skipping verification");
    return false;
  }

  try {
    if (actionType === "like" || actionType === "recast") {
      // Fetch cast reactions and check if FID is in the list
      const reactionType = actionType === "like" ? "likes" : "recasts";
      const url = `${NEYNAR_BASE}/reactions/cast?hash=${castHash}&types=${reactionType}&limit=100`;
      const resp = await fetch(url, {
        headers: { accept: "application/json", api_key: NEYNAR_API_KEY },
      });

      if (!resp.ok) return false;

      const data = await resp.json();
      const reactions = data.reactions ?? [];
      return reactions.some((r: any) => r.user?.fid === fid);
    }

    if (actionType === "reply") {
      // Check replies to the cast and look for one from the FID
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
