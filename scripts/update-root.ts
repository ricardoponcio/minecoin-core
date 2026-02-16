import hre from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

// npx hardhat run scripts/update-root.ts --network amoy
async function main() {
    const CONTRACT_ADDRESS = "0xff41c8eee488accd9073f94cdee57abe596fea68";

    // COLE AQUI O NOVO ROOT GERADO PELO JAVA/TYPESCRIPT
    const NEW_MERKLE_ROOT = "0x3b0111994365939656a30cfe493137f19a6362fa8b342a76d3a820ce2a57e6a1";

    const [deployer] = await (hre as any).viem.getWalletClients();
    const publicClient = await (hre as any).viem.getPublicClient();

    console.log(`🔄 Atualizando Root no contrato: ${CONTRACT_ADDRESS}`);

    // Instancia o contrato (usamos as any para o TS não reclamar da tipagem viem)
    const bbx = await (hre as any).viem.getContractAt("BBX", CONTRACT_ADDRESS);

    const hash = await bbx.write.updateMerkleRoot([NEW_MERKLE_ROOT]);
    console.log("⏳ Aguardando confirmação...");

    await publicClient.waitForTransactionReceipt({ hash });
    console.log("✅ Merkle Root atualizado com sucesso!");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});