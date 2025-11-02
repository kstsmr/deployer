import { prepareTactDeployment } from "@tact-lang/deployer";
import { getArtifactByHash } from "@/lib/contracts/nftProcessing";

export async function createDeploymentLink(args: {
  hash: string;
  network: "testnet" | "mainnet";
}) {
  const artifact = await getArtifactByHash(args.hash);
  const data = Buffer.from(artifact.dataBoc, "base64");

  try {
    const url = await prepareTactDeployment({
      pkg: artifact.pkg,
      data,
      testnet: args.network !== "mainnet",
    });
    return url;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : undefined;
    const message =
      error instanceof Error
        ? error.message
        : "prepareTactDeployment failed with an unknown error";

    if (code === "ECONNRESET" || message.includes("ECONNRESET")) {
      throw new Error("Не удалось связаться с backend для подготовки деплоя. Попробуйте ещё раз позже.");
    }

    throw new Error(message);
  }
}
