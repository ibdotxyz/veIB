import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;

  const { deployer } = await getNamedAccounts();

  const veIBAddress = (await get('ve')).address;

  await deploy("ve_dist", {
    from: deployer,
    args: [veIBAddress],
    log: true,
  });
};
export default func;
func.tags = ["ve_dist"];
