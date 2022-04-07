const { expect } = require("chai")
const { ethers } = require("hardhat")

const DAY = 86400
const WEEK = 7 * DAY

describe("fee dist factory", function() {
  let feeDistFactory

  let tx

  beforeEach(async function() {
    factory = await ethers.getContractFactory("contracts/fee_dist.sol:FeeDistFactory")
    feeDistFactory = await factory.deploy()
    await feeDistFactory.deployed()

    feeDist = await ethers.getContractFactory("contracts/fee_dist.sol:fee_dist")
  })

  it("test create single", async function() {
    const ve = randomAddr()
    const startTimes = [Math.floor(Date.now()/1000)]
    const tokens = [randomAddr()]
    const admins = [randomAddr()]
    const emergencyReturns = [randomAddr()]

    tx = await feeDistFactory.createFeeDist(
      ve,
      startTimes,
      tokens,
      admins,
      emergencyReturns,
    )

    const receipt = await tx.wait()

    expect(receipt.events.length).to.be.equal(1)

    for (let i = 0; i < receipt.events.length; i++) {
      // check event
      const e = receipt.events[i]
      expect(e.args.ve).to.be.equal(ve)
      expect(e.args.token).to.be.equal(tokens[i])
      expect(e.args.startTime).to.be.equal(startTimes[i])
      expect(e.args.admin).to.be.equal(admins[i])
      expect(e.args.emergencyReturn).to.be.equal(emergencyReturns[i])

      // check contract
      const dist = await ethers.getContractAt("contracts/fee_dist.sol:fee_dist", e.args.dist)
      expect(await dist.voting_escrow()).to.be.equal(ve);
      expect(await dist.token()).to.be.equal(tokens[i]);
      expect(await dist.admin()).to.be.equal(admins[i]);
      expect(await dist.emergency_return()).to.be.equal(emergencyReturns[i]);
      expect(await dist.start_time()).to.be.equal(Math.floor(startTimes[i] / WEEK) * WEEK)
    }
  })

  it("test create multiple", async function() {
    let n = 10

    const ve = randomAddr()
    const t = Math.floor(Date.now()/1000) - 3 * DAY
    const startTimes = []
    const tokens = []
    const admins = []
    const emergencyReturns = []

    for (let i = 0; i < n; i++) {
      startTimes.push(t + i * DAY)
      tokens.push(randomAddr())
      admins.push(randomAddr())
      emergencyReturns.push(randomAddr())
    }

    tx = await feeDistFactory.createFeeDist(
      ve,
      startTimes,
      tokens,
      admins,
      emergencyReturns,
    )

    const receipt = await tx.wait()

    expect(receipt.events.length).to.be.equal(n)

    for (let i = 0; i < receipt.events.length; i++) {
      // check event
      const e = receipt.events[i]
      expect(e.args.ve).to.be.equal(ve)
      expect(e.args.token).to.be.equal(tokens[i])
      expect(e.args.startTime).to.be.equal(startTimes[i])
      expect(e.args.admin).to.be.equal(admins[i])
      expect(e.args.emergencyReturn).to.be.equal(emergencyReturns[i])

      // check contract
      const dist = await ethers.getContractAt("contracts/fee_dist.sol:fee_dist", e.args.dist)
      expect(await dist.voting_escrow()).to.be.equal(ve);
      expect(await dist.token()).to.be.equal(tokens[i]);
      expect(await dist.admin()).to.be.equal(admins[i]);
      expect(await dist.emergency_return()).to.be.equal(emergencyReturns[i]);
      expect(await dist.start_time()).to.be.equal(Math.floor(startTimes[i] / WEEK) * WEEK)
    }

  })


})


function randomAddr() {
  const wallet = ethers.Wallet.createRandom()
  return wallet.address
}
