import { expect } from "chai";
import hre from "hardhat";
import { getAddress, parseEther, keccak256, encodePacked } from "viem";

describe("BBX", function () {
    async function deployBBXFixture() {
        const [owner, otherAccount] = await hre.viem.getWalletClients();

        const bbx = await hre.viem.deployContract("BBX", [owner.account.address, owner.account.address]);

        const publicClient = await hre.viem.getPublicClient();

        return {
            bbx,
            owner,
            otherAccount,
            publicClient,
        };
    }

    describe("Deployment", function () {
        it("Should set the right admin and minter", async function () {
            const { bbx, owner } = await deployBBXFixture();

            const MINTER_ROLE = await bbx.read.MINTER_ROLE();
            const DEFAULT_ADMIN_ROLE = await bbx.read.DEFAULT_ADMIN_ROLE();

            expect(await bbx.read.hasRole([DEFAULT_ADMIN_ROLE, owner.account.address])).to.be.true;
            expect(await bbx.read.hasRole([MINTER_ROLE, owner.account.address])).to.be.true;
        });

        it("Should have correct cap", async function () {
            const { bbx } = await deployBBXFixture();
            const cap = await bbx.read.cap();
            // 1 Billion * 10^18
            expect(cap).to.equal(parseEther("1000000000"));
        });
    });

    describe("Minting", function () {
        it("Should allow minter to mint within cap", async function () {
            const { bbx, owner, otherAccount } = await deployBBXFixture();

            await bbx.write.mint([otherAccount.account.address, parseEther("100")]);

            expect(await bbx.read.balanceOf([otherAccount.account.address])).to.equal(parseEther("100"));
        });

        it("Should fail if trying to mint over cap", async function () {
            const { bbx, owner } = await deployBBXFixture();
            const cap = await bbx.read.cap();

            let errorThrown = false;
            try {
                await bbx.write.mint([owner.account.address, cap + 1n]);
            } catch (error: any) {
                errorThrown = true;
            }
            expect(errorThrown).to.be.true;
        });
    });

    describe("Pausing", function () {
        it("Should allow admin to pause and unpause", async function () {
            const { bbx, owner } = await deployBBXFixture();

            await bbx.write.pause();
            expect(await bbx.read.paused()).to.be.true;

            await bbx.write.unpause();
            expect(await bbx.read.paused()).to.be.false;
        });

        it("Should prevent transfers when paused", async function () {
            const { bbx, owner, otherAccount } = await deployBBXFixture();

            await bbx.write.mint([owner.account.address, parseEther("100")]);

            await bbx.write.pause();

            let errorThrown = false;
            try {
                await bbx.write.transfer([otherAccount.account.address, parseEther("50")]);
            } catch (error: any) {
                errorThrown = true;
            }
            expect(errorThrown).to.be.true;
        });
    });

    describe("Merkle Drop and App IDs", function () {
        it("Should allow updating merkle root with appId", async function () {
            const { bbx, owner } = await deployBBXFixture();
            const appId = 1n;
            const newRoot = "0x0000000000000000000000000000000000000000000000000000000000000abc";

            await bbx.write.updateMerkleRoot([appId, newRoot]);

            const root = await bbx.read.merkleRoots([appId]);
            expect(root).to.equal(newRoot);
        });

        it("Should allow claiming with a valid merkle proof per appId", async function () {
            const { bbx, otherAccount } = await deployBBXFixture();
            const appId = 1n;
            const amount = parseEther("100");

            // Generate a Merkle Tree
            // The solidity code expects `abi.encodePacked(msg.sender, totalAllocation)`
            // We can construct the tree values with the raw bytes instead of types.
            // Alternatively, StandardMerkleTree uses `keccak256(abi.encode(types, values))`
            // But since the contract uses `keccak256(abi.encodePacked(msg.sender, totalAllocation))`,
            // we must compute the leaves manually.

            // In OpenZeppelin standard tree, it uses double hashing for leaves.
            // Since our contract uses a custom `keccak256(abi.encodePacked(msg.sender, totalAllocation))`
            // we will simulate the tree structure directly or use the standard tree properly.
            // Let's use the StandardMerkleTree properly by mimicking standard encoding,
            // but the contract uses encodePacked. The StandardMerkleTree expects standard types.
            // Actually, we can use standard merkle tree by passing standard types, and change the contract to use encode?
            // Wait, the prompt said "update functions", didn't strictly say NOT to change claim encoding,
            // but wait, I can just use custom tree generator or let's use the standard tree and pass the leaf as a bytes32?
            // Wait, standard tree hashes the leaves again.
            // Let's use StandardMerkleTree.custom instead of `of`. StandardMerkleTree.of hashes things.

            // To be compatible with `keccak256(abi.encodePacked(...))` without double hashing, we have to construct the tree manually.
            // Or easier, just pass an array of leaves.
            // But for a single leaf, the root is the leaf itself!
            const leaf = keccak256(encodePacked(['address', 'uint256'], [otherAccount.account.address, amount]));
            const root = leaf; // Since it's a 1-leaf tree, root is the leaf
            const proof: `0x${string}`[] = []; // No siblings

            // Update root
            await bbx.write.updateMerkleRoot([appId, root]);

            // Connect as otherAccount
            const bbxAsOther = await hre.viem.getContractAt("BBX", bbx.address, { client: { wallet: otherAccount } });

            // Claim
            await bbxAsOther.write.claim([appId, amount, proof]);

            // Verify balance and claim amount
            expect(await bbx.read.balanceOf([otherAccount.account.address])).to.equal(amount);
            expect(await bbx.read.claimedAmount([appId, otherAccount.account.address])).to.equal(amount);

            // Should fail to claim again with same allocation
            let errorThrown = false;
            try {
                await bbxAsOther.write.claim([appId, amount, proof]);
            } catch (error: any) {
                errorThrown = true;
            }
            expect(errorThrown).to.be.true;
        });

        it("Should allow batch minting by admin per appId", async function () {
            const { bbx, owner, otherAccount } = await deployBBXFixture();
            const appId = 1n;
            const amount = parseEther("100");

            await bbx.write.batchMint([appId, [otherAccount.account.address], [amount]]);

            expect(await bbx.read.balanceOf([otherAccount.account.address])).to.equal(amount);
            expect(await bbx.read.claimedAmount([appId, otherAccount.account.address])).to.equal(amount);

            // Batch minting again with same amount should not mint more
            await bbx.write.batchMint([appId, [otherAccount.account.address], [amount]]);
            expect(await bbx.read.balanceOf([otherAccount.account.address])).to.equal(amount);

            // Increasing the amount will mint the difference
            const newAmount = parseEther("150");
            await bbx.write.batchMint([appId, [otherAccount.account.address], [newAmount]]);
            expect(await bbx.read.balanceOf([otherAccount.account.address])).to.equal(newAmount);
            expect(await bbx.read.claimedAmount([appId, otherAccount.account.address])).to.equal(newAmount);
        });

        it("Should prove isolation: claiming on appId=1 does not affect appId=2", async function () {
            const { bbx, owner, otherAccount } = await deployBBXFixture();
            const appId1 = 1n;
            const appId2 = 2n;
            const amount = parseEther("100");

            // Mint for appId 1
            await bbx.write.batchMint([appId1, [otherAccount.account.address], [amount]]);

            expect(await bbx.read.balanceOf([otherAccount.account.address])).to.equal(amount);
            expect(await bbx.read.claimedAmount([appId1, otherAccount.account.address])).to.equal(amount);

            // User should have 0 claimed on appId 2
            expect(await bbx.read.claimedAmount([appId2, otherAccount.account.address])).to.equal(0n);

            // Mint for appId 2
            await bbx.write.batchMint([appId2, [otherAccount.account.address], [amount]]);

            // Total balance should be 200
            expect(await bbx.read.balanceOf([otherAccount.account.address])).to.equal(parseEther("200"));
            expect(await bbx.read.claimedAmount([appId2, otherAccount.account.address])).to.equal(amount);
        });
    });

    describe("Deposit Bridge", function () {
        it("Should allow users to deposit tokens and burn them", async function () {
            const { bbx, owner, otherAccount, publicClient } = await deployBBXFixture();
            const depositAmount = parseEther("50");
            const appId = 1n;

            // Mint to otherAccount first
            await bbx.write.mint([otherAccount.account.address, parseEther("100")]);

            // Track initial total supply
            const initialTotalSupply = await bbx.read.totalSupply();

            // Connect as otherAccount
            const bbxAsOther = await hre.viem.getContractAt("BBX", bbx.address, { client: { wallet: otherAccount } });

            // Deposit
            const hash = await bbxAsOther.write.depositToGame([appId, depositAmount]);

            // Verify balances
            expect(await bbx.read.balanceOf([otherAccount.account.address])).to.equal(parseEther("50")); // 100 - 50

            // Verify total supply decreased
            const finalTotalSupply = await bbx.read.totalSupply();
            expect(finalTotalSupply).to.equal(initialTotalSupply - depositAmount);

            // Verify event
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            const logs = await publicClient.getContractEvents({
                abi: bbx.abi,
                address: bbx.address,
                eventName: 'DepositedToGame',
                fromBlock: receipt.blockNumber,
                toBlock: receipt.blockNumber
            });

            expect(logs.length).to.equal(1);
            expect(logs[0].args.appId).to.equal(appId);
            expect(getAddress(logs[0].args.playerWallet!)).to.equal(getAddress(otherAccount.account.address));
            expect(logs[0].args.amount).to.equal(depositAmount);
        });

        it("Should fail if deposit amount is 0", async function () {
            const { bbx, otherAccount } = await deployBBXFixture();
            const bbxAsOther = await hre.viem.getContractAt("BBX", bbx.address, { client: { wallet: otherAccount } });
            const appId = 1n;

            let errorThrown = false;
            try {
                await bbxAsOther.write.depositToGame([appId, 0n]);
            } catch (error: any) {
                errorThrown = true;
                expect(error.message).to.include("Amount must be > 0");
            }
            expect(errorThrown).to.be.true;
        });

        it("Should fail if user has insufficient balance", async function () {
             const { bbx, otherAccount } = await deployBBXFixture();
             const bbxAsOther = await hre.viem.getContractAt("BBX", bbx.address, { client: { wallet: otherAccount } });
             const appId = 1n;

             // otherAccount has 0 balance
             let errorThrown = false;
             try {
                 await bbxAsOther.write.depositToGame([appId, parseEther("10")]);
             } catch (error: any) {
                 errorThrown = true;
             }
             expect(errorThrown).to.be.true;
        });
    });
});
