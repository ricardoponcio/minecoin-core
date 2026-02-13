import hre from "hardhat";
import { parseEther } from "viem";

async function main() {
    const [deployer] = await hre.viem.getWalletClients();
    console.log(`Deploying BBX contract with account: ${deployer.account.address}`);

    // Deploy
    const bbx = await hre.viem.deployContract("BBX", [deployer.account.address, deployer.account.address]);
    console.log(`BBX deployed to: ${bbx.address}`);

    // --- Dev Fund Setup (5% Vested) ---
    // 5% of 1 Billion = 50,000,000
    const devFundAmount = parseEther("50000000");

    console.log("Deploying VestingWallet for Dev Fund...");
    const currentBlock = await hre.network.provider.send("eth_getBlockByNumber", ["latest", false]);
    const cleanTimestamp = BigInt(currentBlock.timestamp); // Current block timestamp
    const duration = 2 * 365 * 24 * 60 * 60; // 2 Years in seconds

    // VestingWallet constructor: (beneficiary, startTimestamp, durationSeconds)
    // We need to deploy the OpenZeppelin VestingWallet artifact. 
    // Since it's a library contract, we might need to get it via artifact name or compile it if not exposing it.
    // Easier way: Create a small local contract "DevVesting" that inherits from it, or just use the artifact if available.
    // Let's try deploying it directly from the library artifact if Hardhat exposes it, 
    // OR just creating a simple file for it is safer.

    // Actually, deploying directly from node_modules artifact in viem can be tricky if not compiled.
    // Let's assume we need to add a simple contract file for it to be compiled by Hardhat.

    // HOLD UP: modifying this script relies on VestingWallet being available. 
    // I will write the contract file in the next step, then this script will work.

    const vesting = await hre.viem.deployContract("DevVestingWallet", [
        deployer.account.address, // Beneficiary (You)
        cleanTimestamp,           // Start (Now)
        BigInt(duration)          // Duration (2 Years)
    ]);
    console.log(`VestingWallet deployed to: ${vesting.address}`);

    // Exclude Vesting Contract from Max Wallet Limit
    console.log("Excluding VestingWallet from Max Wallet Limit...");
    await bbx.write.setExcludedFromLimit([vesting.address, true]);

    console.log("Minting Dev Fund (5%) to VestingWallet...");
    await bbx.write.mint([vesting.address, devFundAmount]);
    console.log("Dev Fund Minted and Locked.");
    // ----------------------------
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
