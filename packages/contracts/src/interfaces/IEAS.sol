// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Minimal EAS interface — only what Taskmint needs to verify attestations
struct Attestation {
    bytes32 uid;
    bytes32 schema;
    uint64  time;
    uint64  expirationTime;
    uint64  revocationTime;
    bytes32 refUID;
    address attester;
    address recipient;
    bool    revocable;
    bytes   data;
}

interface IEAS {
    function getAttestation(bytes32 uid) external view returns (Attestation memory);
}
