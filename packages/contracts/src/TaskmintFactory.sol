// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TaskmintBounty} from "./TaskmintBounty.sol";
import {TaskmintTypes} from "./types/TaskmintTypes.sol";
import {IERC20} from "./interfaces/IERC20.sol";

/// @title TaskmintFactory — creates bounty escrow clones and collects fees
contract TaskmintFactory {
    // ── State ────────────────────────────────────────────────────
    address public owner;
    address public implementation;   // TaskmintBounty implementation for cloning
    address public treasury;
    address public eas;              // EAS contract on this chain
    uint256 public feeBps;           // fee in basis points (e.g. 250 = 2.5%)

    uint256 public bountyCount;
    mapping(uint256 => address) public bounties;

    // ── Events ───────────────────────────────────────────────────
    // (re-use TaskmintTypes.BountyCreated)

    // ── Errors ───────────────────────────────────────────────────
    error OnlyOwner();
    error InvalidParams();
    error TransferFailed();
    error CloneFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ── Constructor ──────────────────────────────────────────────
    constructor(
        address _implementation,
        address _treasury,
        address _eas,
        uint256 _feeBps
    ) {
        owner          = msg.sender;
        implementation = _implementation;
        treasury       = _treasury;
        eas            = _eas;
        feeBps         = _feeBps;
    }

    // ── Create bounty ────────────────────────────────────────────
    /// @notice Deploys a new bounty clone and escrows the reward.
    function createBounty(TaskmintTypes.BountyParams calldata params)
        external
        payable
        returns (address bountyAddr)
    {
        if (params.maxWinners == 0) revert InvalidParams();
        if (params.payoutPerWinner == 0) revert InvalidParams();
        if (params.deadline <= block.timestamp) revert InvalidParams();

        // Clone
        bountyAddr = _clone(implementation);

        // Fee
        uint256 fee = (params.rewardAmount * feeBps) / 10_000;
        uint256 escrowed = params.rewardAmount - fee;

        // Validate payout fits within escrowed amount (after fee)
        if (escrowed < uint256(params.maxWinners) * params.payoutPerWinner) {
            revert InvalidParams();
        }

        // Transfer funds
        if (params.rewardToken == address(0)) {
            // ETH
            if (msg.value < params.rewardAmount) revert TransferFailed();
            if (fee > 0) {
                (bool ok, ) = treasury.call{value: fee}("");
                if (!ok) revert TransferFailed();
            }
            (bool ok2, ) = bountyAddr.call{value: escrowed}("");
            if (!ok2) revert TransferFailed();
        } else {
            // ERC-20
            bool ok = IERC20(params.rewardToken).transferFrom(
                msg.sender, address(this), params.rewardAmount
            );
            if (!ok) revert TransferFailed();
            if (fee > 0) {
                IERC20(params.rewardToken).transfer(treasury, fee);
            }
            IERC20(params.rewardToken).transfer(bountyAddr, escrowed);
        }

        // Initialize
        TaskmintBounty(payable(bountyAddr)).initialize(
            msg.sender,
            params.rewardToken,
            escrowed,
            params.payoutPerWinner,
            params.maxWinners,
            params.deadline,
            params.proofType,
            params.verificationData,
            eas
        );

        uint256 id = bountyCount;
        bounties[id] = bountyAddr;
        bountyCount = id + 1;

        emit TaskmintTypes.BountyCreated(
            bountyAddr,
            msg.sender,
            params.titleHash,
            params.proofType,
            escrowed,
            params.deadline
        );
    }

    // ── Admin ────────────────────────────────────────────────────
    function setFeeBps(uint256 _feeBps) external onlyOwner {
        feeBps = _feeBps;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function setEAS(address _eas) external onlyOwner {
        eas = _eas;
    }

    // ── Minimal proxy clone (EIP-1167) ───────────────────────────
    function _clone(address impl) internal returns (address instance) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr,           0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(96, impl))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            instance := create(0, ptr, 0x37)
        }
        if (instance == address(0)) revert CloneFailed();
    }

    receive() external payable {}
}
