const { expect } = require("chai")
const { ethers } = require("hardhat")

DAY = 86400
WEEK = 7 * DAY

describe("fee dist", function() {
  let ib
  let ve
  let feeDist
  let feeToken

  let admin
  let multisig  // address for emergency return
  let user1
  let user2

  let tx

  beforeEach(async function() {
    [admin, multisig, user1, user2] = await ethers.getSigners();

    // deploy ib
    tokenFactory = await ethers.getContractFactory("Token")
    ib = await tokenFactory.deploy("IronBank", "IB", 18, admin.address)
    await ib.deployed()
    tx = await ib.mint(admin.address, ethers.utils.parseEther("1000000"))
    await tx.wait()

    // deploy fee token
    feeToken = await tokenFactory.deploy("FeeToken", "FEE", 18, admin.address)
    await feeToken.deployed()
    tx = await feeToken.mint(admin.address, ethers.utils.parseEther("1000000"))
    await tx.wait()

    // deploy ve
    veFactory = await ethers.getContractFactory("contracts/ve.sol:ve")
    // no need to bother token descriptor in this test
    const tokenDiscriptor = ethers.constants.AddressZero
    ve = await veFactory.deploy(ib.address, tokenDiscriptor)
    await ve.deployed()

    // deploy fee dist
    feeDistFactory = await ethers.getContractFactory("contracts/fee_dist.sol:fee_dist")
    //start_time = Math.floor(Date.now()/1000)
    b = await ethers.provider.getBlock('latest')
    feeDist = await feeDistFactory.deploy(ve.address, b.timestamp, feeToken.address, admin.address, multisig.address)
    await feeDist.deployed()

    // create lock for user1 (31), user2 (69)
    tx = await ib.approve(ve.address, ethers.utils.parseEther("100"))
    await tx.wait()
    //await network.provider.send("evm_setAutomine", [false]);
    const duration = 365 * 24 * 3600
    await ve.create_lock_for(ethers.utils.parseEther("31"), duration, user1.address)
    tx = await ve.create_lock_for(ethers.utils.parseEther("69"), duration, user2.address)
    await tx.wait()
    //await network.provider.send("evm_setAutomine", [true])
    //await network.provider.send("evm_mine", [Math.floor(Date.now()/1000) + 3000])

    expect(await ve.balanceOf(user1.address)).to.equal(1)
    expect(await ve.balanceOf(user2.address)).to.equal(1)

  })


  describe("test kill", function() {

    it("test assumptions", async function() {
      expect(await feeDist.is_killed()).to.equal(false)
      expect(await feeDist.emergency_return()).to.equal(multisig.address)
    })

    it("test kill", async function() {
      tx = await feeDist.kill_me()
      await tx.wait()
      expect(await feeDist.is_killed()).to.equal(true)
    })

    it("test multi kill", async function() {
      tx = await feeDist.kill_me()
      await tx.wait()
      tx = await feeDist.kill_me()
      await tx.wait()
      expect(await feeDist.is_killed()).to.equal(true)
    })

    it("test killing xfers tokens", async function() {
      const amount1 = ethers.utils.parseEther("1234")
      tx = await feeToken.transfer(feeDist.address, amount1)
      await tx.wait()
      expect(await feeToken.balanceOf(feeDist.address)).to.equal(amount1)

      tx = await feeDist.kill_me()
      await tx.wait()
      expect(await feeToken.balanceOf(multisig.address)).to.equal(amount1)
    })

    it("test multi killing xfers tokens", async function() {
      const amount1 = ethers.utils.parseEther("100")
      const amount2 = ethers.utils.parseEther("200")
      tx = await feeToken.transfer(feeDist.address, amount1)
      await tx.wait()
      expect(await feeToken.balanceOf(feeDist.address)).to.equal(amount1)

      tx = await feeDist.kill_me()
      await tx.wait()
      expect(await feeToken.balanceOf(multisig.address)).to.equal(amount1)

      tx = await feeToken.transfer(feeDist.address, amount2)
      await tx.wait()
      expect(await feeToken.balanceOf(feeDist.address)).to.equal(amount2)

      tx = await feeDist.kill_me()
      await tx.wait()
      expect(await feeToken.balanceOf(multisig.address)).to.equal(amount1.add(amount2))
    })

    it("test only admin", async function() {
      await expect(feeDist.connect(multisig).kill_me()).to.be.reverted
    })

    it("test cannot claim after killed", async function() {
      tx = await feeDist.kill_me()
      await tx.wait()
      await expect(feeDist.claim(1)).to.be.revertedWith("killed")
    })

    it("test cannot claim many after killed", async function() {
      tx = await feeDist.kill_me()
      await tx.wait()
      await expect(feeDist.claim_many([1, 2])).to.be.revertedWith("killed")
    })

  })


  describe("test checkpoint", function() {
    it("test checkpoint total supply", async function() {
      startTime = feeDist.time_cursor()

      b = await ethers.provider.getBlock('latest')
      weekEpoch = Math.floor((b.timestamp + WEEK) / WEEK) * WEEK

      await network.provider.send("evm_mine", [weekEpoch])

      b = await ethers.provider.getBlock('latest')
      weekBlock = b.number

      tx = await feeDist.checkpoint_total_supply()
      await tx.wait()

      expect(await feeDist.ve_supply(startTime)).to.equal(0)
      expect(await feeDist.ve_supply(weekEpoch)).to.equal(await ve.totalSupplyAt(weekBlock))
    })

    it("test advance time cursor", async function() {
      startTime = await feeDist.time_cursor()
      b = await ethers.provider.getBlock('latest')
      await network.provider.send("evm_mine", [b.timestamp + 365 * 86400])

      tx = await feeDist.checkpoint_total_supply()
      await tx.wait()

      expect(await feeDist.time_cursor()).to.equal(startTime.toNumber() + WEEK*20)
      expect(await feeDist.ve_supply(startTime.toNumber() + WEEK * 19)).to.gt(0)
      expect(await feeDist.ve_supply(startTime.toNumber() + WEEK * 20)).to.equal(0)

      tx = await feeDist.checkpoint_total_supply()
      await tx.wait()
      expect(await feeDist.time_cursor()).to.equal(startTime.toNumber() + WEEK*40)
      expect(await feeDist.ve_supply(startTime.toNumber() + WEEK * 20)).to.gt(0)
      expect(await feeDist.ve_supply(startTime.toNumber() + WEEK * 39)).to.gt(0)
      expect(await feeDist.ve_supply(startTime.toNumber() + WEEK * 40)).to.equal(0)
    })


    it("test claim checkpoint total supply", async function() {
      startTime = await feeDist.time_cursor()
      tx = await feeDist.claim(1)
      await tx.wait()
      b = await ethers.provider.getBlock('latest')
      expect(await feeDist.time_cursor()).to.equal(startTime.toNumber() + WEEK)
    })

  })

  describe("test fee distribution", function() {
    it("test deposited after", async function() {
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 7; j++) {
          tx = await feeToken.transfer(feeDist.address, ethers.utils.parseEther("1"))
          tx = await feeDist.checkpoint_token()
          tx = await feeDist.checkpoint_total_supply()
          await tx.wait()
          b = await ethers.provider.getBlock("latest")
          await network.provider.send("evm_mine", [b.timestamp + DAY])
        }
      }

      b = await ethers.provider.getBlock("latest")
      await network.provider.send("evm_mine", [b.timestamp + WEEK])

      tx = await ib.approve(ve.address, ethers.utils.parseEther("100"))
      await tx.wait()
      tx = await ve.create_lock_for(ethers.utils.parseEther("100"), 3 * WEEK, user1.address)
      await tx.wait()

      b = await ethers.provider.getBlock("latest")
      await network.provider.send("evm_mine", [b.timestamp + 2 * WEEK])

      tx = await feeDist.claim(3)
      await tx.wait()

      expect(await feeToken.balanceOf(user1.address)).to.eq(0)
    })

    it("test deposited during", async function() {

      // fast foward 2 years, so all ve lock expired
      b = await ethers.provider.getBlock('latest')
      await network.provider.send("evm_mine", [b.timestamp + 2 * 365 * DAY])

      tx = await ve.checkpoint()
      await tx.wait()
      expect(await ve.totalSupply()).to.be.eq(0)

      b = await ethers.provider.getBlock('latest')
      cursor = await feeDist.time_cursor()
      while (b.timestamp - cursor.toNumber() > WEEK) {
        tx = await feeDist.checkpoint_total_supply()
        tx = await feeDist.checkpoint_token()
        await tx.wait()
        cursor = await feeDist.time_cursor()
      }

      expect(await feeDist.tokens_per_week(cursor)).to.be.eq(0)
      expect(await feeDist.tokens_per_week(cursor.sub(WEEK))).to.be.eq(0)
      expect(await feeDist.ve_supply(cursor)).to.be.eq(0)
      expect(await feeDist.ve_supply(cursor.sub(WEEK))).to.be.eq(0)


      // now ve and fee dist are clean
      tx = await ib.approve(ve.address, ethers.utils.parseEther("100"))
      await tx.wait()
      tx = await ve.create_lock_for(ethers.utils.parseEther("100"), 8 * WEEK, user1.address)
      await tx.wait()

      b = await ethers.provider.getBlock('latest')
      await network.provider.send("evm_mine", [b.timestamp + WEEK])
      tx = await feeDist.checkpoint_token()
      await tx.wait()

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 7; j++) {
          tx = await feeToken.transfer(feeDist.address, ethers.utils.parseEther("1"))
          tx = await feeDist.checkpoint_token()
          tx = await feeDist.checkpoint_total_supply()
          await tx.wait()
          b = await ethers.provider.getBlock("latest")
          await network.provider.send("evm_mine", [b.timestamp + DAY])
        }
      }

      b = await ethers.provider.getBlock("latest")
      await network.provider.send("evm_mine", [b.timestamp + WEEK])
      tx = await feeDist.checkpoint_token()
      await tx.wait()


      tx = await feeDist.claim(3)
      await tx.wait()
      balance = await feeToken.balanceOf(user1.address)
      expected = ethers.utils.parseEther("21")
      expect(balance).to.be.gt(expected.sub(10))
      expect(balance).to.be.lt(expected.add(10))
    })

    it("test deposited before", async function() {
      // fast foward 2 years, so all ve lock expired
      b = await ethers.provider.getBlock('latest')
      await network.provider.send("evm_mine", [b.timestamp + 2 * 365 * DAY])

      tx = await ve.checkpoint()
      await tx.wait()
      expect(await ve.totalSupply()).to.be.eq(0)

      b = await ethers.provider.getBlock('latest')
      cursor = await feeDist.time_cursor()
      while (b.timestamp - cursor.toNumber() > WEEK) {
        tx = await feeDist.checkpoint_total_supply()
        tx = await feeDist.checkpoint_token()
        await tx.wait()
        cursor = await feeDist.time_cursor()
      }

      expect(await feeDist.tokens_per_week(cursor)).to.be.eq(0)
      expect(await feeDist.tokens_per_week(cursor.sub(WEEK))).to.be.eq(0)
      expect(await feeDist.ve_supply(cursor)).to.be.eq(0)
      expect(await feeDist.ve_supply(cursor.sub(WEEK))).to.be.eq(0)

      // now ve and fee dist are clean
      tx = await ib.approve(ve.address, ethers.utils.parseEther("100"))
      await tx.wait()
      tx = await ve.create_lock_for(ethers.utils.parseEther("100"), 8 * WEEK, user1.address)
      await tx.wait()

      b = await ethers.provider.getBlock('latest')
      await network.provider.send("evm_mine", [b.timestamp + WEEK])
      tx = await feeDist.checkpoint_token()
      await tx.wait()

      b = await ethers.provider.getBlock('latest')
      await network.provider.send("evm_mine", [b.timestamp + 5 * WEEK])

      tx = await feeToken.transfer(feeDist.address, ethers.utils.parseEther("10"))
      await tx.wait()
      tx = await feeDist.checkpoint_token()
      await tx.wait()
      b = await ethers.provider.getBlock('latest')
      await network.provider.send("evm_mine", [b.timestamp + WEEK])
      tx = await feeDist.checkpoint_token()
      await tx.wait()


      tx = await feeDist.claim(3)
      await tx.wait()

      balance = await feeToken.balanceOf(user1.address)
      expected = ethers.utils.parseEther("10")

      expect(balance).to.be.gt(expected.sub(10))
      expect(balance).to.be.lt(expected.add(10))
    })

    it("test deposited parallel", async function() {
      // fast foward 2 years, so all ve lock expired
      b = await ethers.provider.getBlock('latest')
      await network.provider.send("evm_mine", [b.timestamp + 2 * 365 * DAY])

      tx = await ve.checkpoint()
      await tx.wait()
      expect(await ve.totalSupply()).to.be.eq(0)

      b = await ethers.provider.getBlock('latest')
      cursor = await feeDist.time_cursor()
      while (b.timestamp - cursor.toNumber() > WEEK) {
        tx = await feeDist.checkpoint_total_supply()
        tx = await feeDist.checkpoint_token()
        await tx.wait()
        cursor = await feeDist.time_cursor()
      }

      expect(await feeDist.tokens_per_week(cursor)).to.be.eq(0)
      expect(await feeDist.tokens_per_week(cursor.sub(WEEK))).to.be.eq(0)
      expect(await feeDist.ve_supply(cursor)).to.be.eq(0)
      expect(await feeDist.ve_supply(cursor.sub(WEEK))).to.be.eq(0)

      // now ve and fee dist are clean
      tx = await ib.approve(ve.address, ethers.utils.parseEther("1000"))
      await tx.wait()
      tx = await ve.create_lock_for(ethers.utils.parseEther("300"), 8 * WEEK, user1.address)
      tx = await ve.create_lock_for(ethers.utils.parseEther("300"), 8 * WEEK, user2.address)
      tx = await ve.create_lock_for(ethers.utils.parseEther("400"), 8 * WEEK, multisig.address)
      await tx.wait()

      b = await ethers.provider.getBlock("latest")
      await network.provider.send("evm_mine", [b.timestamp + WEEK])
      tx = await feeDist.checkpoint_token()
      await tx.wait()

      b = await ethers.provider.getBlock("latest")
      await network.provider.send("evm_mine", [b.timestamp + 5 * WEEK])

      tx = await feeToken.transfer(feeDist.address, ethers.utils.parseEther("10"))
      await tx.wait()

      tx = await feeDist.checkpoint_token()
      await tx.wait()
      b = await ethers.provider.getBlock("latest")
      await network.provider.send("evm_mine", [b.timestamp + WEEK])
      tx = await feeDist.checkpoint_token()
      await tx.wait()

      tx = await feeDist.claim(3)
      tx = await feeDist.claim(4)
      tx = await feeDist.claim(5)
      await tx.wait()

      balance1 = await feeToken.balanceOf(user1.address)
      balance2 = await feeToken.balanceOf(user2.address)
      balance3 = await feeToken.balanceOf(multisig.address)
      expect(balance1).to.be.eq(balance2)
      expect(balance3).to.be.gt(balance1)

      expected = ethers.utils.parseEther("10")
      sum = balance1.add(balance2).add(balance3)
      expect(sum).to.be.gt(expected.sub(20))
      expect(sum).to.be.lt(expected.add(20))
    })

  })

  describe("test claim many", function() {
    it("testc claim many", async function() {
      startTime = await feeDist.time_cursor()
      b = await ethers.provider.getBlock('latest')
      await network.provider.send("evm_mine", [b.timestamp + 5 * WEEK])
      tx = await feeToken.transfer(feeDist.address, ethers.utils.parseEther("1000"))
      await tx.wait()

      tx = await feeDist.checkpoint_token()
      await tx.wait()

      snapshot = await network.provider.send("evm_snapshot")
      tx = await feeDist.claim_many([1, 2])
      await tx.wait()

      balance1 = await feeToken.balanceOf(user1.address)
      balance2 = await feeToken.balanceOf(user2.address)

      expect(balance1).to.gt(0)
      expect(balance2).to.gt(0)

      await network.provider.send("evm_revert", [snapshot])

      tx = await feeDist.claim(1)
      tx = await feeDist.claim(2)
      await tx.wait()

      expect(await feeToken.balanceOf(user1.address)).to.equal(balance1)
      expect(await feeToken.balanceOf(user2.address)).to.equal(balance2)
    })

    it("testc claim many same id", async function() {
      startTime = await feeDist.time_cursor()
      b = await ethers.provider.getBlock('latest')
      await network.provider.send("evm_mine", [b.timestamp + 5 * WEEK])
      tx = await feeToken.transfer(feeDist.address, ethers.utils.parseEther("1000"))
      await tx.wait()

      tx = await feeDist.checkpoint_token()
      tx = await feeDist.checkpoint_total_supply()
      await tx.wait()

      expected = await feeDist.claimable(1)

      tx = await feeDist.claim_many([1, 1, 1, 1, 1, 1, 1, 1, 1])
      await tx.wait()

      expect(await feeToken.balanceOf(user1.address)).to.equal(expected)
    })

  })


  describe("test admin", function() {
    it("test only admin can set pending admin", async function() {
      await expect(feeDist.connect(user1).set_pending_admin(multisig.address)).to.reverted
    })

    it("test set pending admin", async function() {
      await expect(await feeDist.set_pending_admin(multisig.address))
        .to.emit(feeDist, "NewPendingAdmin")
        .withArgs(ethers.constants.AddressZero, multisig.address)
      expect(await feeDist.pending_admin()).to.equal(multisig.address)
    })

    it("test accept admin", async function() {
      tx = await feeDist.set_pending_admin(multisig.address)
      await tx.wait()
      expect(await feeDist.pending_admin()).to.equal(multisig.address)

      await expect(feeDist.connect(multisig).accept_admin())
      .to.emit(feeDist, "NewAdmin")
      .withArgs(admin.address, multisig.address)

      expect(await feeDist.admin()).to.equal(multisig.address)
      expect(await feeDist.pending_admin()).to.equal(ethers.constants.AddressZero)
    })

    it("test only pending admin can accept admin", async function() {
      tx = await feeDist.set_pending_admin(multisig.address)
      await tx.wait()
      expect(await feeDist.pending_admin()).to.equal(multisig.address)

      await expect(feeDist.accept_admin()).to.be.reverted
      expect(await feeDist.admin()).to.equal(admin.address)
      expect(await feeDist.pending_admin()).to.equal(multisig.address)
    })

  })

  describe("test recover balance", function() {
    it("test only admin", async function() {
      await expect(feeDist.connect(multisig.address).recover_balance(ib.address)).to.be.reverted
    })

    it("test cannot recover reward token", async function() {
      await expect(feeDist.recover_balance(feeToken.address)).to.be.reverted
    })

    it("test success", async function() {
      const amount = ethers.utils.parseEther("4321")
      tx = await ib.transfer(feeDist.address, amount)
      await tx.wait()

      expect(await ib.balanceOf(feeDist.address)).to.equal(amount)
      await expect(feeDist.recover_balance(ib.address))
        .to.emit(ib, "Transfer")
        .withArgs(feeDist.address, admin.address, amount)
    })

  })
})
