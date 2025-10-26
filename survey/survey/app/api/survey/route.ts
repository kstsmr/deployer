import { NextResponse } from "next/server";
import { z } from "zod";

import { executeSurvey, getContractById } from "@/lib/survey/runSurvey";

export const runtime = "nodejs";

const payloadSchema = z.object({
  contractId: z.string().min(1, "Укажите контракт"),
  address: z.string().min(2, "Укажите адрес контракта"),
  network: z.enum(["mainnet", "testnet"]).default("testnet"),
  rpcUrl: z
    .string()
    .url("Некорректный RPC URL")
    .optional()
    .or(z.literal("")),
  rpcKey: z.string().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  try {
    const payload = payloadSchema.parse(await request.json());
    const contract = getContractById(payload.contractId);
    if (!contract) {
      return NextResponse.json({ status: "error", message: "Такой опросник не найден" }, { status: 404 });
    }

    const result = await executeSurvey({
      contract,
      address: payload.address.trim(),
      network: payload.network,
      rpcUrl: payload.rpcUrl?.trim() || undefined,
      rpcKey: payload.rpcKey?.trim() || undefined,
    });

    return NextResponse.json({ status: "ok", result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 400 });
    }

    console.error("[survey] run failed", error);
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Не удалось выполнить опрос" },
      { status: 500 }
    );
  }
}
