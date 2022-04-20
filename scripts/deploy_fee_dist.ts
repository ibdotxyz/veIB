import {deployments, ethers, getNamedAccounts} from 'hardhat';
const {get, getArtifact, save} = deployments;

async function main() {
  const { multisig } = await getNamedAccounts();
  const veIBAddress = (await get('ve')).address;
  const feeDistFactoryAddress = (await get('FeeDistFactory')).address;

  // Fill in the following params before running this script
  const FeeDistParams = [
    {
      startTime: 1650499200,
      token: "0x888EF71766ca594DED1F0FA3AE64eD2941740A20"
    },
    {
      startTime: 1650499200,
      token: "0x328A7b4d538A2b3942653a9983fdA3C12c571141"
    },
  ]

  const startTimes = []
  const tokens = []
  const admins = []
  const emergencyReturns = []

  for (const p of FeeDistParams) {
    startTimes.push(p.startTime)
    tokens.push(p.token)
    admins.push(multisig)
    emergencyReturns.push(multisig)
  }

  const feeDistFactory = await ethers.getContractAt('contracts/fee_dist.sol:FeeDistFactory', feeDistFactoryAddress)
  let tx = await feeDistFactory.createFeeDist(veIBAddress, startTimes, tokens, admins, emergencyReturns)
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
    const feeDistABI = (await getArtifact('contracts/fee_dist.sol:fee_dist')).abi
    // const feeSymbol = await (await ethers.getContractAt([{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"}], e.args.token)).symbol()
    await save(`FeeDist-${e.args.token}`, {
      abi: feeDistABI,
      address: e.args.dist,
      solcInputHash: '32cca34e5afee13e7ff743205c4f10d1',
      args: [e.args.ve, e.args.startTime, e.args.token, e.args.admin, e.args.emergencyReturn],
      transactionHash: receipt.hash
    });
  }
}

async function deployTestFactory() {
  const factory = await ethers.getContractFactory('contracts/fee_dist.sol:FeeDistFactory')
  const f = await factory.deploy()
  await f.deployed()
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.log(err)
    process.exit(1)
  })
