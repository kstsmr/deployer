import { prepareTactDeployment } from "@tact-lang/deployer";
import { getArtifactByHash } from "@/lib/contracts/nftProcessing";

export async function createDeploymentLink(args: {
  hash: string;
  network: "testnet" | "mainnet";
}) {
  const artifact = await getArtifactByHash(args.hash);
  const data = Buffer.from(artifact.dataBoc, "base64");

  const url = await prepareTactDeployment({
    pkg: artifact.pkg,
    data,
    testnet: args.network !== "mainnet",
  });

  return url;
}
