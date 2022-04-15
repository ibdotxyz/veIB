import { ethers } from "hardhat"


// Fill in the following params before running this script
const Address = {
  VE: '',
  FeeDistFactory: '',
}

const FeeDistParams = [
  {
    startTime: 0,
    token: "",
    admin: "",
    emergencyReturns: ""
  },
]


async function main() {
  // await deployTestFactory()

  const startTimes = []
  const tokens = []
  const admins = []
  const emergencyReturns = []

  for (const p of FeeDistParams) {
    startTimes.push(p.startTime)
    tokens.push(p.token)
    admins.push(p.admin)
    emergencyReturns.push(p.emergencyReturns)
  }

  const feeDistFactory = await ethers.getContractAt('contracts/fee_dist.sol:FeeDistFactory', Address.FeeDistFactory)

  let tx = await feeDistFactory.createFeeDist(Address.VE, startTimes, tokens, admins, emergencyReturns)
  console.log('creating fee dist contract...')
  console.log(`tx: ${tx.hash}`)
  console.log('---')
  const receipt = await tx.wait()
  for (const e of receipt.events) {
    console.log(`fee dist contract: ${e.args.dist}`)
    console.log(`               ve: ${e.args.ve}`)
    console.log(`        fee token: ${e.args.token}`)
    console.log(`       start time: ${e.args.startTime}`)
    console.log(`            admin: ${e.args.admin}`)
    console.log(` emergency return: ${e.args.emergencyReturn}`)
    console.log('----')
  }
}

async function deployTestFactory() {
  const factory = await ethers.getContractFactory('contracts/fee_dist.sol:FeeDistFactory')
  const f = await factory.deploy()
  await f.deployed()
  Address.FeeDistFactory = f.address
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.log(err)
    process.exit(1)
  })
