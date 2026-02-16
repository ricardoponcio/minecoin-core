import hre from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const CONTRACT_ADDRESS = "0xff41c8eee488accd9073f94cdee57abe596fea68";

    // COLE AQUI O NOVO ROOT GERADO PELO JAVA/TYPESCRIPT
    const NEW_MERKLE_ROOT = "0xc1651724a47650681f15ba349976f904dee5404061a101712f086f5845e2170c";

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