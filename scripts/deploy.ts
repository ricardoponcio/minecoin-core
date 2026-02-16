import hre from "hardhat";
import "@nomicfoundation/hardhat-viem";
import { parseEther, keccak256, toHex } from "viem";
import * as dotenv from "dotenv"; // Importante para ler o .env no script também

dotenv.config();


// npx hardhat run scripts/deploy.ts --network amoy
async function main() {
    // Casting 'as any' para o TypeScript não encher o saco
    const publicClient = await (hre as any).viem.getPublicClient();
    const [deployer] = await (hre as any).viem.getWalletClients();

    if (!deployer) {
        throw new Error("❌ ERRO: Nenhuma conta encontrada. Verifique se a PRIVATE_KEY está no arquivo .env");
    }

    console.log(`🚀 Iniciando Deploy com a conta OWNER: ${deployer.account.address}`);

    // --- LÓGICA SEM HARDCODE ---
    // Tenta pegar do .env. Se não tiver, usa o próprio dono (para testes)
    let botAddress = deployer.account.address;

    if (process.env.BOT_ADDRESS && process.env.BOT_ADDRESS.startsWith("0x")) {
        botAddress = process.env.BOT_ADDRESS as `0x${string}`;
    } else {
        console.warn("⚠️ AVISO: BOT_ADDRESS não encontrado no .env. Usando o deployer como bot.");
    }

    console.log(`🤖 Endereço do Bot (Minter/Updater): ${botAddress}`);

    // 1. Deploy do Token BBX
    const bbx = await (hre as any).viem.deployContract("BBX", [
        deployer.account.address,
        botAddress
    ]);
    console.log(`✅ BBX Token deployado em: ${bbx.address}`);

    // 2. Setup do Vesting
    const devFundAmount = parseEther("50000000");
    const currentBlock = await publicClient.getBlock();
    const cleanTimestamp = currentBlock.timestamp;
    const duration = BigInt(2 * 365 * 24 * 60 * 60);

    console.log("⏳ Deployando VestingWallet...");
    const vesting = await (hre as any).viem.deployContract("DevVestingWallet", [
        deployer.account.address,
        cleanTimestamp,
        duration
    ]);
    console.log(`🏦 Carteira de Vesting: ${vesting.address}`);

    // 3. Excluir Vesting do limite
    try {
        console.log("🔓 Excluindo Vesting do Max Wallet Limit...");
        await bbx.write.setExcludedFromLimit([vesting.address, true]);
    } catch (e) {
        console.log("⚠️ Ignorado: setExcludedFromLimit falhou ou não existe.");
    }

    // 4. MINT DO FUNDO DE DEV 
    console.log("🛠️ Verificando permissões para Mint inicial...");
    const MINTER_ROLE = keccak256(toHex("MINTER_ROLE"));
    const isBotDifferent = botAddress.toLowerCase() !== deployer.account.address.toLowerCase();

    if (isBotDifferent) {
        console.log("⚠️ Deployer não é o Minter. Concedendo permissão temporária...");
        await bbx.write.grantRole([MINTER_ROLE, deployer.account.address]);
    }

    console.log("💸 Mintando 5% para o Vesting...");
    await bbx.write.mint([vesting.address, devFundAmount]);

    if (isBotDifferent) {
        console.log("🔒 Revogando permissão temporária...");
        await bbx.write.revokeRole([MINTER_ROLE, deployer.account.address]);
    }

    console.log("----------------------------------------------------");
    console.log("🎉 DEPLOY FINALIZADO!");
    console.log(`Token:   ${bbx.address}`);
    console.log(`Vesting: ${vesting.address}`);
    console.log("----------------------------------------------------");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });