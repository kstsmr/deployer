import { NextResponse } from "next/server";
import { getArtifactSummary } from "@/lib/contracts/nftProcessing";

export const runtime = "nodejs";

export async function GET() {
  try {
    const artifact = await getArtifactSummary();
    return NextResponse.json({ status: "ok", artifact });
  } catch (error) {
    console.error("[contracts][nft-processing] load error", error);
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to load NftProccessing artifact",
      },
      { status: 500 }
    );
  }
}
