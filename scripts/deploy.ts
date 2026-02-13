import hre from "hardhat";

async function main() {
    const [deployer] = await hre.viem.getWalletClients();
    console.log(`Deploying BBX contract with account: ${deployer.account.address}`);

    const bbx = await hre.viem.deployContract("BBX", [deployer.account.address, deployer.account.address]);

    console.log(`BBX deployed to: ${bbx.address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
