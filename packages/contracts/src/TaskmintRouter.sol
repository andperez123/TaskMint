// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TaskmintRouter — execute standardized tasks and record completions
/// @notice For TX_EVENT-type bounties, the executor performs the task *through*
///         this router so that the bounty contract can verify completion.
contract TaskmintRouter {
    // ── State ────────────────────────────────────────────────────
    address public owner;

    /// completions[bountyAddress][executor] = true if completed
    mapping(address => mapping(address => bool)) public completions;

    // ── Events ───────────────────────────────────────────────────
    event TaskCompleted(
        address indexed bounty,
        address indexed executor,
        bytes32 indexed actionHash
    );

    // ── Errors ───────────────────────────────────────────────────
    error OnlyOwner();
    error CallFailed();
    error AlreadyCompleted();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ── Execute a task through the router ────────────────────────
    /// @notice The executor calls this to perform an arbitrary external call
    ///         (swap, LP add, etc.) and record completion against a bounty.
    /// @param bounty   The TaskmintBounty address this task fulfils.
    /// @param target   The contract to call (e.g. DEX router, staking contract).
    /// @param data     Encoded calldata for the external call.
    function executeTask(
        address bounty,
        address target,
        bytes calldata data
    ) external payable {
        if (completions[bounty][msg.sender]) revert AlreadyCompleted();

        // Forward call
        (bool ok, ) = target.call{value: msg.value}(data);
        if (!ok) revert CallFailed();

        // Record completion
        completions[bounty][msg.sender] = true;

        emit TaskCompleted(bounty, msg.sender, keccak256(data));
    }

    // ── Admin: manual completion (for migration / edge cases) ────
    function recordCompletion(address bounty, address executor) external onlyOwner {
        completions[bounty][executor] = true;
        emit TaskCompleted(bounty, executor, bytes32(0));
    }

    receive() external payable {}
}
