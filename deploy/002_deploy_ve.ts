import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;

  const { deployer, ironBankToken } = await getNamedAccounts();

  const tokenDescriptor = await get('TokenDescriptor');

  await deploy("ve", {
    from: deployer,
    args: [ironBankToken, tokenDescriptor.address],
    log: true,
  });
};
export default func;
func.tags = ["veIB"];
