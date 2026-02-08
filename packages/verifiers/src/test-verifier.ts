import type { Request, Response } from "express";

interface TestAttestRequest {
  bountyId: string;      // bounty contract address
  executorWallet: string;
  commitHash: string;    // git commit hash
  reportHash: string;    // IPFS/Arweave hash of test report
  pass: boolean;
}

/**
 * POST /proof/test/attest
 *
 * 1. (Optional) Verifies the commit exists in the repo.
 * 2. (Optional) Validates the report hash is accessible.
 * 3. Submits an EAS attestation for passing test results.
 * 4. Returns the attestation UID.
 *
 * Phase 3 implementation — this is the skeleton.
 */
export async function handleTestAttest(req: Request, res: Response) {
  try {
    const body = req.body as TestAttestRequest;
    const { bountyId, executorWallet, commitHash, reportHash, pass } = body;

    if (!bountyId || !executorWallet || !commitHash || !reportHash) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!pass) {
      return res.status(400).json({ error: "Tests did not pass" });
    }

    // TODO (Phase 3): Validate the commit and report
    // - Check that commitHash exists in the expected repo
    // - Check that reportHash is accessible on IPFS/Arweave
    // - Optionally re-run tests ourselves

    // TODO (Phase 3): Submit EAS attestation with:
    //   schema: TEST_SCHEMA_UID
    //   recipient: executorWallet
    //   data: abi.encode(bountyAddress, executorWallet, commitHash, reportHash, pass, timestamp)
    const attestationUID = "0x_TODO_ATTESTATION_UID";

    console.log(
      `[test-verifier] Verified tests for bounty ${bountyId} by ${executorWallet}, commit=${commitHash}`
    );

    return res.json({
      ok: true,
      attestationUID,
      bountyId,
      executorWallet,
      commitHash,
      reportHash,
      pass,
    });
  } catch (err) {
    console.error("[test-verifier] error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
