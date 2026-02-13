# MineCoin (BBX) Core

Smart contracts and scripts for the Minecraft L2 Economy Integration.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- [Java JDK](https://adoptium.net/) (v21+ for Minecraft 1.20+)
- An Arbitrum Sepolia Wallet (e.g., MetaMask) with some ETH for gas.

## Setup

1.  **Clone the repository** (if not already done).
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Environment Configuration**:
    Set the following configuration variables/environment variables:
    - `SEPOLIA_RPC_URL`: RPC URL for Sepolia (optional)
    - `SEPOLIA_PRIVATE_KEY`: Private Key for Sepolia (optional)
    - `ARBITRUM_SEPOLIA_RPC_URL`: RPC URL for Arbitrum Sepolia.
    - `PRIVATE_KEY`: Your wallet private key (begins with `0x...` or not, depending on how you export).

    *Note: We are using Hardhat's configuration variables or `.env`. If using `.env`, ensure `dotenv` is configured in `hardhat.config.ts`.*

## Deployment

To deploy the **BBX** contract to Arbitrum Sepolia:

```bash
npx hardhat run scripts/deploy.ts --network arbitrumSepolia
```

## Smart Contract

The core contract is `contracts/BBX.sol`. It is an ERC-20 token with `AccessControl` and `ERC20Burnable`.

- **Name**: BBX
- **Symbol**: BBX
- **Roles**:
    - `DEFAULT_ADMIN_ROLE`: Admin role.
    - `MINTER_ROLE`: Role allowed to mint tokens (assigned to the Java Plugin).
