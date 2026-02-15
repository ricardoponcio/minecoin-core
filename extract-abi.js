const fs = require('fs');
const path = require('path');

// Caminho do artefato gerado pelo Hardhat
const artifactPath = path.resolve(__dirname, 'artifacts/contracts/MineCoin.sol/MineCoin.json');

// Onde vamos salvar os arquivos separados
const outputDir = path.resolve(__dirname, 'build_output');

// Cria a pasta de saída se não existir
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// Lê o JSON do Hardhat
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

// 1. Salva o ABI separado
const abiPath = path.resolve(outputDir, 'MineCoin.abi');
fs.writeFileSync(abiPath, JSON.stringify(artifact.abi));
console.log(`ABI extraída em: ${abiPath}`);

// 2. Salva o BIN separado (Bytecode)
const binPath = path.resolve(outputDir, 'MineCoin.bin');
// O Web3j precisa do bytecode SEM aspas, apenas a string crua
fs.writeFileSync(binPath, artifact.bytecode);
console.log(`BIN extraído em: ${binPath}`);