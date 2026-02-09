// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TaskmintBounty} from "../src/TaskmintBounty.sol";
import {TaskmintFactory} from "../src/TaskmintFactory.sol";
import {TaskmintTypes} from "../src/types/TaskmintTypes.sol";
import {Attestation} from "../src/interfaces/IEAS.sol";

/// @dev Minimal mock of the EAS contract
contract MockEAS {
    mapping(bytes32 => Attestation) public attestations;

    function setAttestation(bytes32 uid, Attestation memory att) external {
        attestations[uid] = att;
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory) {
        return attestations[uid];
    }
}

contract EASClaimTest is Test {
    TaskmintFactory factory;
    TaskmintBounty bountyImpl;
    MockEAS eas;

    address creator = address(0xC1);
    address executor = address(0xE1);

    bytes32 constant SCHEMA_UID = 0x594b9be4c91edd864c69e502e209d09bfebbfd9ef022d4c2fd9e05fc60c752a7;
    bytes32 constant ATT_UID = 0xaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd;

    receive() external payable {}

    function setUp() public {
        eas = new MockEAS();
        bountyImpl = new TaskmintBounty();
        factory = new TaskmintFactory(
            address(bountyImpl),
            address(this), // treasury
            address(eas),
            250 // 2.5% fee
        );

        vm.deal(creator, 10 ether);
        vm.deal(executor, 1 ether);
    }

    function testEASClaim() public {
        // 1. Create EAS bounty
        bytes memory vdata = abi.encode(
            TaskmintTypes.EASVerificationData({
                schemaUID: SCHEMA_UID,
                approvedAttesters: new address[](0)
            })
        );

        vm.prank(creator);
        address bountyAddr = factory.createBounty{value: 1 ether}(
            TaskmintTypes.BountyParams({
                titleHash: keccak256("Test EAS Bounty"),
                specURI: "social://like/0xdeadbeef",
                rewardToken: address(0),
                rewardAmount: 1 ether,
                payoutPerWinner: 0.4 ether,
                maxWinners: 2,
                deadline: uint64(block.timestamp + 7 days),
                proofType: TaskmintTypes.ProofType.EAS_ATTESTATION,
                verificationData: vdata
            })
        );

        TaskmintBounty bounty = TaskmintBounty(payable(bountyAddr));

        // Debug
        console.log("bounty addr:", bountyAddr);
        console.log("proofType:", uint8(bounty.proofType()));
        console.logBytes(bounty.verificationData());

        // 2. Mock the EAS attestation
        // Encode attestation data: address bountyAddress, address executorWallet, uint256 fid, bytes32 castHash, string actionType, uint256 timestamp
        bytes memory attData = abi.encode(
            bountyAddr,
            executor,
            uint256(12345),
            keccak256("0xdeadbeef"),
            "like",
            block.timestamp
        );

        eas.setAttestation(ATT_UID, Attestation({
            uid: ATT_UID,
            schema: SCHEMA_UID,
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            attester: address(this),
            recipient: executor,
            revocable: true,
            data: attData
        }));

        // 3. Claim with attestation UID
        bytes memory proof = abi.encode(ATT_UID);
        console.log("proof length:", proof.length);
        console.logBytes(proof);

        vm.prank(executor);
        bounty.claim(proof);

        // 4. Verify
        assertTrue(bounty.claimed(executor));
        assertEq(bounty.winnersCount(), 1);
    }
}
