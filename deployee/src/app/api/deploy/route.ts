import { NextResponse } from "next/server";
import { z } from "zod";
import { createDeploymentLink } from "@/lib/deployer/tact";

export const runtime = "nodejs";

const payloadSchema = z.object({
  hash: z.string().min(1, "Hash обязателен"),
  network: z.enum(["testnet", "mainnet"]).default("testnet"),
});

export async function POST(request: Request) {
  try {
    const payload = payloadSchema.parse(await request.json());
    const url = await createDeploymentLink({ hash: payload.hash, network: payload.network });
    return NextResponse.json({ status: "ok", url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 400 });
    }

    console.error("[deploy] prepare link error", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Failed to prepare deployment",
      },
      { status: 500 }
    );
  }
}
