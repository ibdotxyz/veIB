import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("TokenDescriptor", {
    from: deployer,
    proxy: true,
    log: true,
  });
};
export default func;
func.tags = ["TokenDescriptor"];
