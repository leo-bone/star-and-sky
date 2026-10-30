// 部署 StarSkyBSC 到 BNB Smart Chain（主网或测试网）
// 用法：
//   1) 安装依赖：  cd contracts-dir && npm install
//   2) 配置私钥：  export PRIVATE_KEY=0x你的部署钱包私钥
//   3) 部署主网：  npx hardhat run scripts/deploy-bsc.js --network bscMainnet
//      部署测试网：npx hardhat run scripts/deploy-bsc.js --network bscTestnet
//   4) 把输出的合约地址填入 前端 js/mint.js 的 CONFIG.chains.bsc.contract
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying StarSkyBSC with:", deployer.address);

  const baseURI = process.env.BASE_URI || "ipfs://";
  const StarSky = await hre.ethers.getContractFactory("StarSkyBSC");
  const contract = await StarSky.deploy(deployer.address, baseURI);
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  console.log("✅ StarSkyBSC deployed at:", addr);
  console.log("→ 把它填入 js/mint.js 的 CONFIG.chains.bsc.contract");
  console.log("→ 铸造手续费：用户支付极少 BNB 作为 gas（合约本身免费铸造）");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
