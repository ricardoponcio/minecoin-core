// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract BBX is
    ERC20,
    ERC20Burnable,
    ERC20Pausable,
    AccessControl,
    ERC20Permit,
    ERC20Votes,
    ERC20Capped
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MERKLE_UPDATER_ROLE =
        keccak256("MERKLE_UPDATER_ROLE");

    // --- Merkle Drop State ---
    bytes32 public merkleRoot;
    mapping(address => uint256) public claimedAmount;

    event MerkleRootUpdated(bytes32 indexed newRoot);
    event Claimed(address indexed user, uint256 amount);
    event DepositedToGame(address indexed playerWallet, uint256 amount);

    // --- Mint Limiter State ---
    uint256 public mintCapPerPeriod; // Max amount allowed to mint per period
    uint256 public lastMintPeriod; // Timestamp of the last reset
    uint256 public mintedInPeriod; // Amount minted in current period
    uint256 public constant MINT_PERIOD = 1 days;

    // --- Anti-Whale State ---
    uint256 public maxWalletSize; // 3% of Total Cap
    mapping(address => bool) public isExcludedFromLimit; // Whitelist

    address public treasuryAddress;

    error MintLimitExceeded(uint256 requested, uint256 available);
    error MaxWalletExceeded(uint256 balance, uint256 limit);
    error InvalidProof();
    error NothingToClaim();

    constructor(
        address defaultAdmin,
        address minter
    )
        ERC20("BBX", "BBX")
        ERC20Permit("BBX")
        ERC20Capped(1000000000 * 10 ** decimals()) // 1 Billion Cap
    {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _grantRole(MERKLE_UPDATER_ROLE, defaultAdmin);
        _grantRole(MERKLE_UPDATER_ROLE, minter);

        // Define Mint Rate Limit: 10% of Total Cap per 24h
        mintCapPerPeriod = (cap() * 10) / 100;
        lastMintPeriod = block.timestamp;

        // Define Max Wallet Size: 3% of Total Cap
        maxWalletSize = (cap() * 3) / 100;

        // Exclude Admin, Minter, and Contract from limits
        isExcludedFromLimit[defaultAdmin] = true;
        isExcludedFromLimit[minter] = true;
        isExcludedFromLimit[address(this)] = true;

        treasuryAddress = defaultAdmin;
    }

    function setExcludedFromLimit(
        address account,
        bool excluded
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        isExcludedFromLimit[account] = excluded;
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        // --- Rate Limiter Logic ---
        if (block.timestamp >= lastMintPeriod + MINT_PERIOD) {
            // New Period
            mintedInPeriod = 0;
            lastMintPeriod = block.timestamp;
        }

        if (mintedInPeriod + amount > mintCapPerPeriod) {
            revert MintLimitExceeded(amount, mintCapPerPeriod - mintedInPeriod);
        }

        mintedInPeriod += amount;
        // --------------------------

        _mint(to, amount);
    }

    // --- Merkle Drop Logic ---

    function updateMerkleRoot(
        bytes32 _merkleRoot
    ) public onlyRole(MERKLE_UPDATER_ROLE) {
        merkleRoot = _merkleRoot;
        emit MerkleRootUpdated(_merkleRoot);
    }

    function claim(uint256 totalAllocation, bytes32[] calldata proof) public {
        if (totalAllocation <= claimedAmount[msg.sender]) {
            revert NothingToClaim();
        }

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, totalAllocation));
        if (!MerkleProof.verify(proof, merkleRoot, leaf)) {
            revert InvalidProof();
        }

        uint256 toMint = totalAllocation - claimedAmount[msg.sender];
        claimedAmount[msg.sender] = totalAllocation;

        _mint(msg.sender, toMint);
        emit Claimed(msg.sender, toMint);
    }

    /**
     * @notice Distribui tokens baseado no TOTAL acumulado (Snapshot).
     * @dev Calcula a diferença entre o total e o que já foi sacado.
     * Evita pagamentos duplicados (Idempotência).
     */
    function batchMint(
        address[] calldata recipients,
        uint256[] calldata totalAllocations
    ) external onlyRole(MINTER_ROLE) {
        require(
            recipients.length == totalAllocations.length,
            "Arrays length mismatch"
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            address user = recipients[i];
            uint256 total = totalAllocations[i];

            if (total > claimedAmount[user]) {
                uint256 toMint = total - claimedAmount[user];
                claimedAmount[user] = total;
                _mint(user, toMint);
            }
        }
    }

    // --- Deposit Bridge Logic ---

    function setTreasuryAddress(
        address newTreasury
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        treasuryAddress = newTreasury;
    }

    function depositToGame(uint256 amount) public {
        require(amount > 0, "Amount must be > 0");
        _transfer(msg.sender, treasuryAddress, amount);
        emit DepositedToGame(msg.sender, amount);
    }

    // The following functions are overrides required by Solidity.

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Pausable, ERC20Votes, ERC20Capped) {
        // --- Max Wallet Check ---
        // Only check on receiving (to), not sending (from)
        // Ignore minting (from == 0) because minting has its own Rate Limiter,
        // BUT strict Anti-Whale might want to block excessive minting to a single user too.
        // Let's enforce it generally, unless excluded.

        if (
            to != address(0) && to != address(this) && !isExcludedFromLimit[to]
        ) {
            if (balanceOf(to) + value > maxWalletSize) {
                revert MaxWalletExceeded(balanceOf(to) + value, maxWalletSize);
            }
        }
        // ------------------------

        super._update(from, to, value);
    }

    function nonces(
        address owner
    ) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
