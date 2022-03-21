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
    ironBankToken: '0x00a35FD824c717879BF370E70AC6868b95870Dfb',
    multisig: '0xA5fC0BbfcD05827ed582869b7254b6f141BA84Eb'
  },
  networks: {
    hardhat: {
      forking: {
        url: `https://rpc.ftm.tools/`
      }
    },
    ftm: {
      url: 'https://rpc.ftm.tools/',
      accounts:
        process.env.DEPLOY_PRIVATE_KEY == undefined ? [] : [`0x${process.env.DEPLOY_PRIVATE_KEY}`]
    }
  }
};

export default config;
