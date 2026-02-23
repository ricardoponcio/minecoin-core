import { expect } from "chai";
import hre from "hardhat";
import { getAddress, parseEther } from "viem";

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

    describe("Deposit Bridge", function () {
        it("Should set initial treasury address correctly", async function () {
            const { bbx, owner } = await deployBBXFixture();
            expect(await bbx.read.treasuryAddress()).to.equal(getAddress(owner.account.address));
        });

        it("Should allow admin to set new treasury address", async function () {
            const { bbx, owner, otherAccount } = await deployBBXFixture();

            await bbx.write.setTreasuryAddress([otherAccount.account.address]);
            expect(await bbx.read.treasuryAddress()).to.equal(getAddress(otherAccount.account.address));
        });

        it("Should prevent non-admin from setting treasury address", async function () {
            const { bbx, otherAccount } = await deployBBXFixture();

            let errorThrown = false;
            try {
                // Connect as otherAccount
                const bbxAsOther = await hre.viem.getContractAt("BBX", bbx.address, { client: { wallet: otherAccount } });
                await bbxAsOther.write.setTreasuryAddress([otherAccount.account.address]);
            } catch (error: any) {
                errorThrown = true;
            }
            expect(errorThrown).to.be.true;
        });

        it("Should allow users to deposit tokens", async function () {
            const { bbx, owner, otherAccount, publicClient } = await deployBBXFixture();
            const depositAmount = parseEther("50");

            // Mint to otherAccount first
            await bbx.write.mint([otherAccount.account.address, parseEther("100")]);

            // Connect as otherAccount
            const bbxAsOther = await hre.viem.getContractAt("BBX", bbx.address, { client: { wallet: otherAccount } });

            // Deposit
            const hash = await bbxAsOther.write.depositToGame([depositAmount]);

            // Verify balances
            expect(await bbx.read.balanceOf([otherAccount.account.address])).to.equal(parseEther("50")); // 100 - 50
            expect(await bbx.read.balanceOf([owner.account.address])).to.equal(depositAmount); // Treasury (owner) received 50

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
            expect(getAddress(logs[0].args.playerWallet!)).to.equal(getAddress(otherAccount.account.address));
            expect(logs[0].args.amount).to.equal(depositAmount);
        });

        it("Should fail if deposit amount is 0", async function () {
            const { bbx, otherAccount } = await deployBBXFixture();
            const bbxAsOther = await hre.viem.getContractAt("BBX", bbx.address, { client: { wallet: otherAccount } });

            let errorThrown = false;
            try {
                await bbxAsOther.write.depositToGame([0n]);
            } catch (error: any) {
                errorThrown = true;
                expect(error.message).to.include("Amount must be > 0");
            }
            expect(errorThrown).to.be.true;
        });

        it("Should fail if user has insufficient balance", async function () {
             const { bbx, otherAccount } = await deployBBXFixture();
             const bbxAsOther = await hre.viem.getContractAt("BBX", bbx.address, { client: { wallet: otherAccount } });

             // otherAccount has 0 balance
             let errorThrown = false;
             try {
                 await bbxAsOther.write.depositToGame([parseEther("10")]);
             } catch (error: any) {
                 errorThrown = true;
             }
             expect(errorThrown).to.be.true;
        });
    });
});
