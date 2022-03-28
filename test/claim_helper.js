const { expect } = require("chai")
const { ethers } = require("hardhat")

DAY = 86400
WEEK = 7 * DAY

describe("claim helper", function() {
  let ib
  let ve
  let claimHelper

  let feeDists = []
  let feeTokens = []

  let admin
  let users

  let tx

  beforeEach(async function() {
    [admin, ...users] = await ethers.getSigners();

    // deploy ib
    tokenFactory = await ethers.getContractFactory("Token")
    ib = await tokenFactory.deploy("IronBank", "IB", 18, admin.address)
    await ib.deployed()
    tx = await ib.mint(admin.address, ethers.utils.parseEther("1000000"))
    await tx.wait()


    // deploy ve
    veFactory = await ethers.getContractFactory("contracts/ve.sol:ve")
    // no need to bother token descriptor in this test
    const tokenDiscriptor = ethers.constants.AddressZero
    ve = await veFactory.deploy(ib.address, tokenDiscriptor)
    await ve.deployed()

    feeDistFactory = await ethers.getContractFactory("contracts/fee_dist.sol:fee_dist")

    feeTokens = []
    feeDists = []
    // deploy fee token and fee dist
    for (let i = 0; i < 3; i++) {
      const feeToken = await tokenFactory.deploy("FeeToken", "FEE", 18, admin.address)
      await feeToken.deployed()
      tx = await feeToken.mint(admin.address, ethers.utils.parseEther("1000000"))
      await tx.wait()


      const b = await ethers.provider.getBlock('latest')
      const feeDist = await feeDistFactory.deploy(ve.address, b.timestamp, feeToken.address, admin.address, admin.address)
      await feeDist.deployed()

      feeTokens.push(feeToken)
      feeDists.push(feeDist)
    }

    tx = await ib.approve(ve.address, ethers.utils.parseEther("10000"))
    await tx.wait()
    const duration = 365 * 24 * 3600
    for (let i = 0; i < 3; i++) {
      await ve.create_lock_for(ethers.utils.parseEther("100"), duration, users[i].address)
      await tx.wait()
      expect(await ve.balanceOf(users[i].address)).to.equal(1)
    }


    claimHelperFactory = await ethers.getContractFactory("contracts/ClaimHelper.sol:ClaimHelper")
    claimHelper = await claimHelperFactory.deploy()
    await claimHelper.deployed()


    b = await ethers.provider.getBlock('latest')
    await network.provider.send("evm_mine", [b.timestamp + 10 * WEEK])
    for (let i = 0; i < 3; i++) {
      tx = await feeTokens[i].transfer(feeDists[i].address, ethers.utils.parseEther("1000"))
      await tx.wait()
      tx = await feeDists[i].checkpoint_token()
      await tx.wait()
    }

  })


  it("test claim for different fee_dist, same token", async function() {
    feeDistIndex = [0, 1, 2]
    tokenIds = [1, 1, 1]
    addresses = feeDistIndex.map((i) => feeDists[i].address)

    tx = await claimHelper.claim(addresses, tokenIds)
    await tx.wait()

    for (let i = 0; i < 3; i++) {
      expect(await feeTokens[i].balanceOf(users[0].address)).to.gt(0)
      expect(await feeTokens[i].balanceOf(users[1].address)).to.eq(0)
      expect(await feeTokens[i].balanceOf(users[2].address)).to.eq(0)
    }
  })

  it("test claim for different fee_dist, different token", async function() {
    feeDistIndex = [0, 1, 2]
    tokenIds = [3, 2, 1]
    addresses = feeDistIndex.map((i) => feeDists[i].address)

    tx = await claimHelper.claim(addresses, tokenIds)
    await tx.wait()

    for (let i = 0; i < 3; i++) {
      const feeToken = feeTokens[feeDistIndex[i]]
      const user = users[tokenIds[i]-1]
      for (let j = 0; j < 3; j++) {
        if (users[j].address === user.address) {
          expect(await feeToken.balanceOf(users[j].address)).to.gt(0)
        } else {
          expect(await feeToken.balanceOf(users[j].address)).to.eq(0)
        }
      }
    }
  })

  it("test claim for same fee_dist, same token", async function() {
    feeDistIndex = [0, 0, 0]
    tokenIds = [1, 1, 1]
    addresses = feeDistIndex.map((i) => feeDists[i].address)

    tx = await claimHelper.claim(addresses, tokenIds)
    await tx.wait()

   expect(await feeTokens[0].balanceOf(users[0].address)).to.gt(0)
   expect(await feeTokens[0].balanceOf(users[1].address)).to.eq(0)
   expect(await feeTokens[0].balanceOf(users[2].address)).to.eq(0)
  })

  it("test claim for same fee_dist, different token", async function() {
    feeDistIndex = [0, 0, 0]
    tokenIds = [3, 2, 1]
    addresses = feeDistIndex.map((i) => feeDists[i].address)

    tx = await claimHelper.claim(addresses, tokenIds)
    await tx.wait()

    for (let i = 0; i < 3; i++) {
      expect(await feeTokens[0].balanceOf(users[i].address)).to.gt(0)
    }
  })

})
