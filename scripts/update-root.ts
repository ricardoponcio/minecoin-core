import hre from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

// npx hardhat run scripts/update-root.ts --network amoy
async function main() {
    const CONTRACT_ADDRESS = "0x6ce1e1d74f4592e1d11ebb05cfd50be0830ef9a8";

    // COLE AQUI O NOVO ROOT GERADO PELO JAVA/TYPESCRIPT
    const NEW_MERKLE_ROOT = "0xc28898a20a8e2bd61700aa3f42e71e138df9acabe5d365d8f4becbdbc4a412e9";

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