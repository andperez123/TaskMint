// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TaskmintBounty} from "../src/TaskmintBounty.sol";
import {TaskmintFactory} from "../src/TaskmintFactory.sol";
import {TaskmintRouter} from "../src/TaskmintRouter.sol";
import {TaskmintTypes} from "../src/types/TaskmintTypes.sol";

contract TaskmintFactoryTest is Test {
    TaskmintFactory factory;
    TaskmintRouter  router;
    TaskmintBounty  bountyImpl;

    address treasury = makeAddr("treasury");
    address creator  = makeAddr("creator");
    address executor = makeAddr("executor");
    address eas      = makeAddr("eas"); // mock

    function setUp() public {
        bountyImpl = new TaskmintBounty();
        router     = new TaskmintRouter();
        factory    = new TaskmintFactory(
            address(bountyImpl),
            treasury,
            eas,
            250 // 2.5%
        );

        vm.deal(creator, 100 ether);
        vm.deal(executor, 10 ether);
    }

    // ── Helpers ──────────────────────────────────────────────────
    function _defaultParams() internal view returns (TaskmintTypes.BountyParams memory) {
        return TaskmintTypes.BountyParams({
            titleHash: keccak256("Test Bounty"),
            specURI: "ipfs://QmTest",
            rewardToken: address(0), // ETH
            rewardAmount: 1 ether,
            payoutPerWinner: 0.5 ether,
            maxWinners: 2,
            deadline: uint64(block.timestamp + 7 days),
            proofType: TaskmintTypes.ProofType.TX_EVENT,
            verificationData: abi.encode(address(router))
        });
    }

    // ── Tests ────────────────────────────────────────────────────
    function test_createBounty_ETH() public {
        TaskmintTypes.BountyParams memory p = _defaultParams();

        vm.prank(creator);
        address bountyAddr = factory.createBounty{value: 1 ether}(p);

        assertEq(factory.bountyCount(), 1);
        assertEq(factory.bounties(0), bountyAddr);

        TaskmintBounty bounty = TaskmintBounty(payable(bountyAddr));
        assertEq(bounty.creator(), creator);
        assertEq(bounty.maxWinners(), 2);
        assertEq(bounty.winnersCount(), 0);

        // Fee: 2.5% of 1 ETH = 0.025 ETH → treasury
        assertEq(treasury.balance, 0.025 ether);
        // Escrowed: 0.975 ETH
        assertEq(bounty.remainingReward(), 0.975 ether);
    }

    function test_claim_via_router() public {
        TaskmintTypes.BountyParams memory p = _defaultParams();

        vm.prank(creator);
        address bountyAddr = factory.createBounty{value: 1 ether}(p);

        // Executor performs task through router
        vm.prank(executor);
        router.executeTask(bountyAddr, address(0), ""); // trivial call for test

        // Executor claims
        uint256 balBefore = executor.balance;
        vm.prank(executor);
        TaskmintBounty(payable(bountyAddr)).claim(abi.encode(address(router)));

        assertEq(TaskmintBounty(payable(bountyAddr)).winnersCount(), 1);
        assertTrue(TaskmintBounty(payable(bountyAddr)).claimed(executor));
        assertGt(executor.balance, balBefore);
    }

    function test_withdrawUnclaimed() public {
        TaskmintTypes.BountyParams memory p = _defaultParams();

        vm.prank(creator);
        address bountyAddr = factory.createBounty{value: 1 ether}(p);

        // Warp past deadline
        vm.warp(block.timestamp + 8 days);

        uint256 remaining = TaskmintBounty(payable(bountyAddr)).remainingReward();
        uint256 balBefore = creator.balance;

        vm.prank(creator);
        TaskmintBounty(payable(bountyAddr)).withdrawUnclaimed();

        assertEq(creator.balance, balBefore + remaining);
        assertEq(TaskmintBounty(payable(bountyAddr)).remainingReward(), 0);
    }

    function test_revert_claimAfterDeadline() public {
        TaskmintTypes.BountyParams memory p = _defaultParams();

        vm.prank(creator);
        address bountyAddr = factory.createBounty{value: 1 ether}(p);

        vm.warp(block.timestamp + 8 days);

        vm.prank(executor);
        vm.expectRevert(TaskmintBounty.BountyExpired.selector);
        TaskmintBounty(payable(bountyAddr)).claim("");
    }

    function test_revert_doubleClaim() public {
        TaskmintTypes.BountyParams memory p = _defaultParams();

        vm.prank(creator);
        address bountyAddr = factory.createBounty{value: 1 ether}(p);

        vm.prank(executor);
        router.executeTask(bountyAddr, address(0), "");

        vm.prank(executor);
        TaskmintBounty(payable(bountyAddr)).claim(abi.encode(address(router)));

        vm.prank(executor);
        vm.expectRevert(TaskmintBounty.AlreadyClaimed.selector);
        TaskmintBounty(payable(bountyAddr)).claim(abi.encode(address(router)));
    }

    function test_statePredicate_bounty() public {
        // Deploy a simple counter to test STATE_PREDICATE
        SimpleCounter counter = new SimpleCounter();

        TaskmintTypes.StatePredicateData memory sp = TaskmintTypes.StatePredicateData({
            targetContract: address(counter),
            selector: bytes4(keccak256("value()")),
            callData: "",
            predicate: TaskmintTypes.Predicate.GTE,
            expectedValue: 5
        });

        TaskmintTypes.BountyParams memory p = TaskmintTypes.BountyParams({
            titleHash: keccak256("Counter Bounty"),
            specURI: "ipfs://QmCounter",
            rewardToken: address(0),
            rewardAmount: 1 ether,
            payoutPerWinner: 0.9 ether,
            maxWinners: 1,
            deadline: uint64(block.timestamp + 7 days),
            proofType: TaskmintTypes.ProofType.STATE_PREDICATE,
            verificationData: abi.encode(sp)
        });

        vm.prank(creator);
        address bountyAddr = factory.createBounty{value: 1 ether}(p);

        // Counter not yet at 5 — claim should fail
        vm.prank(executor);
        vm.expectRevert(TaskmintBounty.ProofInvalid.selector);
        TaskmintBounty(payable(bountyAddr)).claim("");

        // Increment to 5
        for (uint256 i = 0; i < 5; i++) counter.increment();

        // Now claim should succeed
        vm.prank(executor);
        TaskmintBounty(payable(bountyAddr)).claim("");

        assertEq(TaskmintBounty(payable(bountyAddr)).winnersCount(), 1);
    }
}

/// Simple helper contract for STATE_PREDICATE tests
contract SimpleCounter {
    uint256 public value;

    function increment() external {
        value++;
    }
}
