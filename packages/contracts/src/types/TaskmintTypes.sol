// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TaskmintTypes — shared enums and structs for the Taskmint protocol
library TaskmintTypes {
    // ── Proof types ──────────────────────────────────────────────
    enum ProofType {
        TX_EVENT,          // verified via TaskmintRouter canonical event
        STATE_PREDICATE,   // verified via on-chain staticcall + predicate
        EAS_ATTESTATION    // verified via EAS attestation lookup
    }

    enum Predicate {
        EQ,   // ==
        GTE,  // >=
        LTE,  // <=
        GT,   // >
        LT    // <
    }

    // ── Bounty params (passed to Factory.createBounty) ───────────
    struct BountyParams {
        bytes32 titleHash;          // keccak256 of human-readable title
        string  specURI;            // IPFS/Arweave URI for full spec
        address rewardToken;        // ERC-20 token address (address(0) = ETH)
        uint256 rewardAmount;       // total reward escrowed
        uint256 payoutPerWinner;    // amount each winner receives
        uint16  maxWinners;         // maximum claimants
        uint64  deadline;           // unix timestamp
        ProofType proofType;
        bytes   verificationData;   // encoded per proof type
    }

    // ── Verification data sub-structs (encoded into verificationData) ──

    /// For STATE_PREDICATE
    struct StatePredicateData {
        address targetContract;
        bytes4  selector;       // staticcall function selector
        bytes   callData;       // extra calldata appended after selector (may encode executor placeholder)
        Predicate predicate;
        uint256 expectedValue;
    }

    /// For EAS_ATTESTATION
    struct EASVerificationData {
        bytes32   schemaUID;
        address[] approvedAttesters;  // empty = any attester
    }

    // ── Events ───────────────────────────────────────────────────
    event BountyCreated(
        address indexed bountyAddress,
        address indexed creator,
        bytes32 titleHash,
        ProofType proofType,
        uint256 rewardAmount,
        uint64 deadline
    );

    event BountyClaimed(
        address indexed bountyAddress,
        address indexed executor,
        uint256 payout
    );

    event BountyWithdrawn(
        address indexed bountyAddress,
        address indexed creator,
        uint256 amount
    );
}
