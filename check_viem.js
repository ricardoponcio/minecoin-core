import hre from "hardhat";

async function main() {
    console.log("Checking hre.viem...");
    if (hre.viem) {
        console.log("SUCCESS: hre.viem is available!");
    } else {
        console.log("INFO: hre.viem is NOT available.");
    }

    console.log("Checking hre.network.connect()...");
    try {
        const connection = await hre.network.connect();
        if (connection.viem) {
            console.log("SUCCESS: connection.viem is available!");
            console.log("Available properties:", Object.keys(connection.viem));
        } else {
            console.log("FAILURE: connection.viem is NOT available.");
            console.log("Connection keys:", Object.keys(connection));
        }
    } catch (error) {
        console.error("Error connecting to network:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
