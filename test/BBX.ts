import { describe, it } from "node:test";
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
});
