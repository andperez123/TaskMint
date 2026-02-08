// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TaskmintTypes} from "./types/TaskmintTypes.sol";
import {IEAS, Attestation} from "./interfaces/IEAS.sol";
import {IERC20} from "./interfaces/IERC20.sol";

/// @title TaskmintBounty — escrow clone that holds reward and validates proof
/// @notice Deployed as minimal proxy (clone) by TaskmintFactory.
///         initialize() is called once after cloning.
contract TaskmintBounty {
    using TaskmintTypes for *;

    // ── State ────────────────────────────────────────────────────
    bool    public initialized;
    address public factory;
    address public creator;
    address public rewardToken;      // address(0) = native ETH
    uint256 public remainingReward;
    uint256 public payoutPerWinner;
    uint16  public maxWinners;
    uint16  public winnersCount;
    uint64  public deadline;

    TaskmintTypes.ProofType public proofType;
    bytes   public verificationData;

    mapping(address => bool) public claimed;

    address public eas;  // EAS contract address (set by factory)

    // ── Errors ───────────────────────────────────────────────────
    error AlreadyInitialized();
    error OnlyFactory();
    error BountyExpired();
    error BountyNotExpired();
    error AlreadyClaimed();
    error MaxWinnersReached();
    error ProofInvalid();
    error TransferFailed();
    error OnlyCreator();

    // ── Modifiers ────────────────────────────────────────────────
    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    modifier onlyCreator() {
        if (msg.sender != creator) revert OnlyCreator();
        _;
    }

    modifier beforeDeadline() {
        if (block.timestamp > deadline) revert BountyExpired();
        _;
    }

    modifier afterDeadline() {
        if (block.timestamp <= deadline) revert BountyNotExpired();
        _;
    }

    // ── Initializer (called once by factory after clone) ─────────
    function initialize(
        address _creator,
        address _rewardToken,
        uint256 _rewardAmount,
        uint256 _payoutPerWinner,
        uint16  _maxWinners,
        uint64  _deadline,
        TaskmintTypes.ProofType _proofType,
        bytes calldata _verificationData,
        address _eas
    ) external {
        if (initialized) revert AlreadyInitialized();
        initialized = true;

        factory        = msg.sender;
        creator        = _creator;
        rewardToken    = _rewardToken;
        remainingReward = _rewardAmount;
        payoutPerWinner = _payoutPerWinner;
        maxWinners     = _maxWinners;
        deadline       = _deadline;
        proofType      = _proofType;
        verificationData = _verificationData;
        eas            = _eas;
    }

    // ── Claim ────────────────────────────────────────────────────
    /// @notice Executor calls this to claim the bounty reward.
    /// @param proof ABI-encoded proof — contents depend on proofType.
    function claim(bytes calldata proof) external beforeDeadline {
        if (claimed[msg.sender])      revert AlreadyClaimed();
        if (winnersCount >= maxWinners) revert MaxWinnersReached();

        // Validate proof
        bool valid = _verifyProof(msg.sender, proof);
        if (!valid) revert ProofInvalid();

        // Mark claimed
        claimed[msg.sender] = true;
        winnersCount++;
        remainingReward -= payoutPerWinner;

        // Pay
        _transfer(msg.sender, payoutPerWinner);

        emit TaskmintTypes.BountyClaimed(address(this), msg.sender, payoutPerWinner);
    }

    // ── Withdraw unclaimed (after deadline) ──────────────────────
    function withdrawUnclaimed() external onlyCreator afterDeadline {
        uint256 amount = remainingReward;
        remainingReward = 0;
        _transfer(creator, amount);

        emit TaskmintTypes.BountyWithdrawn(address(this), creator, amount);
    }

    // ── Proof verification router ────────────────────────────────
    function _verifyProof(address executor, bytes calldata proof)
        internal
        view
        returns (bool)
    {
        if (proofType == TaskmintTypes.ProofType.TX_EVENT) {
            return _verifyTxEvent(executor, proof);
        } else if (proofType == TaskmintTypes.ProofType.STATE_PREDICATE) {
            return _verifyStatePredicate(executor, proof);
        } else if (proofType == TaskmintTypes.ProofType.EAS_ATTESTATION) {
            return _verifyEASAttestation(executor, proof);
        }
        return false;
    }

    // ── TX_EVENT: checks that executor emitted completion via Router ──
    function _verifyTxEvent(address executor, bytes calldata proof)
        internal
        view
        returns (bool)
    {
        // proof = abi.encode(address router)
        // The Router must have recorded a completion for this bounty + executor.
        // We store the router address in verificationData.
        address router = abi.decode(verificationData, (address));

        // Ask the router if executor completed this bounty
        (bool success, bytes memory result) = router.staticcall(
            abi.encodeWithSignature(
                "completions(address,address)",
                address(this),
                executor
            )
        );
        if (!success) return false;
        return abi.decode(result, (bool));
    }

    // ── STATE_PREDICATE: staticcall target and compare value ─────
    function _verifyStatePredicate(address executor, bytes calldata /* proof */)
        internal
        view
        returns (bool)
    {
        TaskmintTypes.StatePredicateData memory sp =
            abi.decode(verificationData, (TaskmintTypes.StatePredicateData));

        // Build calldata: selector + original callData (may include executor placeholder)
        // Convention: if callData contains 0xEEEE...EEEE (20 bytes), replace with executor
        bytes memory cd = abi.encodePacked(sp.selector, _replaceExecutor(sp.callData, executor));

        (bool success, bytes memory result) = sp.targetContract.staticcall(cd);
        if (!success) return false;

        uint256 actual = abi.decode(result, (uint256));
        return _evalPredicate(sp.predicate, actual, sp.expectedValue);
    }

    // ── EAS_ATTESTATION: look up attestation and validate fields ─
    function _verifyEASAttestation(address executor, bytes calldata proof)
        internal
        view
        returns (bool)
    {
        bytes32 attestationUID = abi.decode(proof, (bytes32));

        TaskmintTypes.EASVerificationData memory ev =
            abi.decode(verificationData, (TaskmintTypes.EASVerificationData));

        Attestation memory att = IEAS(eas).getAttestation(attestationUID);

        // Schema must match
        if (att.schema != ev.schemaUID) return false;

        // Must not be revoked
        if (att.revocationTime != 0) return false;

        // Recipient must be executor
        if (att.recipient != executor) return false;

        // Attester allowlist (if set)
        if (ev.approvedAttesters.length > 0) {
            bool attesterOk = false;
            for (uint256 i = 0; i < ev.approvedAttesters.length; i++) {
                if (att.attester == ev.approvedAttesters[i]) {
                    attesterOk = true;
                    break;
                }
            }
            if (!attesterOk) return false;
        }

        // Attestation data should encode the bountyId (this contract address)
        // We expect first 32 bytes of att.data = abi.encode(bountyAddress)
        if (att.data.length < 32) return false;
        address bountyRef = abi.decode(att.data, (address));
        if (bountyRef != address(this)) return false;

        return true;
    }

    // ── Helpers ──────────────────────────────────────────────────
    function _evalPredicate(
        TaskmintTypes.Predicate pred,
        uint256 actual,
        uint256 expected
    ) internal pure returns (bool) {
        if (pred == TaskmintTypes.Predicate.EQ)  return actual == expected;
        if (pred == TaskmintTypes.Predicate.GTE) return actual >= expected;
        if (pred == TaskmintTypes.Predicate.LTE) return actual <= expected;
        if (pred == TaskmintTypes.Predicate.GT)  return actual >  expected;
        if (pred == TaskmintTypes.Predicate.LT)  return actual <  expected;
        return false;
    }

    /// @dev Replace the sentinel address 0xEEeE...eEEE in callData with the executor address
    function _replaceExecutor(bytes memory data, address executor)
        internal
        pure
        returns (bytes memory)
    {
        if (data.length < 20) return data;

        bytes20 sentinel = bytes20(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);
        bytes20 rep      = bytes20(executor);
        uint256 end = data.length - 19;
        for (uint256 i = 0; i < end; i++) {
            bool match_ = true;
            for (uint256 j = 0; j < 20; j++) {
                if (data[i + j] != sentinel[j]) {
                    match_ = false;
                    break;
                }
            }
            if (match_) {
                for (uint256 j = 0; j < 20; j++) {
                    data[i + j] = rep[j];
                }
            }
        }
        return data;
    }

    function _transfer(address to, uint256 amount) internal {
        if (rewardToken == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            bool ok = IERC20(rewardToken).transfer(to, amount);
            if (!ok) revert TransferFailed();
        }
    }

    receive() external payable {}
}
