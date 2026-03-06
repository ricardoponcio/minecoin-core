import hre from "hardhat";
import "@nomicfoundation/hardhat-viem";
import { parseEther, keccak256, toHex } from "viem";
import * as dotenv from "dotenv";

dotenv.config();

// npx hardhat compile
// npx hardhat run scripts/deploy.ts --network amoy
async function main() {
    // Casting 'as any' para evitar erro de TS
    const publicClient = await (hre as any).viem.getPublicClient();
    const [deployer] = await (hre as any).viem.getWalletClients();

    if (!deployer) {
        throw new Error("❌ ERRO: Nenhuma conta encontrada. Verifique o .env");
    }

    console.log(`🚀 Iniciando Deploy com a conta OWNER: ${deployer.account.address}`);

    // --- CONFIGURAÇÃO DO BOT ---
    let botAddress = deployer.account.address;
    if (process.env.BOT_ADDRESS && process.env.BOT_ADDRESS.startsWith("0x")) {
        botAddress = process.env.BOT_ADDRESS as `0x${string}`;
    }
    console.log(`🤖 Endereço do Bot (Minter/Updater): ${botAddress}`);

    // 1. Deploy do Token BBX
    const bbx = await (hre as any).viem.deployContract("BBX", [
        deployer.account.address,
        botAddress
    ], {
        gasPrice: 100000000000n,
    });
    console.log(`✅ BBX Token deployado em: ${bbx.address}`);

    // 2. Setup do Vesting
    const devFundAmount = parseEther("50000000"); // 50 Milhões
    const currentBlock = await publicClient.getBlock();
    const cleanTimestamp = currentBlock.timestamp;
    const duration = BigInt(2 * 365 * 24 * 60 * 60); // 2 Anos

    console.log("⏳ Deployando VestingWallet...");
    const vesting = await (hre as any).viem.deployContract("DevVestingWallet", [
        deployer.account.address,
        cleanTimestamp,
        duration
    ]);
    console.log(`🏦 Carteira de Vesting: ${vesting.address}`);

    // 3. Excluir Vesting do limite (COM WAIT)
    try {
        console.log("🔓 Excluindo Vesting do Max Wallet Limit...");
        const hashExclusion = await bbx.write.setExcludedFromLimit([vesting.address, true]);

        // AQUI ESTÁ A CORREÇÃO: Esperamos a blockchain confirmar antes de continuar
        await publicClient.waitForTransactionReceipt({ hash: hashExclusion });
        console.log("✅ Confirmação recebida: Vesting excluído do limite.");

    } catch (e) {
        console.log("⚠️ Erro ao excluir do limite (pode falhar se o mint ocorrer antes):", e);
    }

    // 4. MINT DO FUNDO DE DEV 
    console.log("🛠️ Verificando permissões para Mint inicial...");
    const MINTER_ROLE = keccak256(toHex("MINTER_ROLE"));
    const isBotDifferent = botAddress.toLowerCase() !== deployer.account.address.toLowerCase();

    // Se precisar dar permissão temporária
    if (isBotDifferent) {
        console.log("⚠️ Concedendo permissão temporária de Minter...");
        const hashGrant = await bbx.write.grantRole([MINTER_ROLE, deployer.account.address]);
        await publicClient.waitForTransactionReceipt({ hash: hashGrant }); // Wait
        console.log("✅ Permissão concedida.");
    }

    console.log("💸 Mintando 5% para o Vesting...");
    // Agora é seguro mintar, pois a exclusão do limite JÁ FOI confirmada
    const hashMint = await bbx.write.mint([vesting.address, devFundAmount]);
    await publicClient.waitForTransactionReceipt({ hash: hashMint }); // Wait
    console.log("✅ Mint confirmado.");

    // Revoga permissão
    if (isBotDifferent) {
        console.log("🔒 Revogando permissão temporária...");
        const hashRevoke = await bbx.write.revokeRole([MINTER_ROLE, deployer.account.address]);
        await publicClient.waitForTransactionReceipt({ hash: hashRevoke }); // Wait
    }

    console.log("----------------------------------------------------");
    console.log("🎉 DEPLOY FINALIZADO COM SUCESSO!");
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