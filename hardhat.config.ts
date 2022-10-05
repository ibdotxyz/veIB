import 'dotenv/config';
import {HardhatUserConfig} from 'hardhat/types';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';

 const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    version: '0.8.11',
    settings: {
      optimizer: {
        enabled: true
      }
    },
  },
  namedAccounts: {
    deployer: 0,
    ironBankToken: {
      hardhat: '0x00a35FD824c717879BF370E70AC6868b95870Dfb',
      ftm: '0x00a35FD824c717879BF370E70AC6868b95870Dfb',
      testnet: '0xb1f656B82507cd07daBD71f966294E2262B465AD',
      op: '0x00a35FD824c717879BF370E70AC6868b95870Dfb',
    },
    multisig: {
      hardhat: '0xA5fC0BbfcD05827ed582869b7254b6f141BA84Eb',
      ftm: '0xA5fC0BbfcD05827ed582869b7254b6f141BA84Eb',
      testnet: 0,
      op: '0xfB9423283EB7F65210B9aB545ecC212B5AE52b3A',
    }
  },
  networks: {
    hardhat: {
      forking: {
        url: `https://rpc.ftm.tools/`,
        enabled: false,
      }
    },
    fantom: {
      url: 'https://rpc.ftm.tools/',
      accounts:
        process.env.DEPLOY_PRIVATE_KEY == undefined ? [] : [`0x${process.env.DEPLOY_PRIVATE_KEY}`]
    },
    testnet: {
      url: 'https://rpc.testnet.fantom.network/',
      accounts:
        process.env.DEPLOY_PRIVATE_KEY == undefined ? [] : [`0x${process.env.DEPLOY_PRIVATE_KEY}`]
    },
    op: {
      url: `https://optimism-mainnet.infura.io/v3/${process.env.INFURA_TOKEN}`,
      accounts:
        process.env.DEPLOY_PRIVATE_KEY == undefined ? [] : [`0x${process.env.DEPLOY_PRIVATE_KEY}`]
    },
  }
};

export default config;
