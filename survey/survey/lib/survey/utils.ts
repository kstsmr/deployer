import { RunGetMethodResult, TonStackItem } from "@/lib/ton/jsonRpcClient";

export function stackItemToBigInt(entry?: TonStackItem): bigint | null {
  if (!entry) return null;
  const [kind, value] = entry;
  if (kind !== "num" || typeof value !== "string") {
    return null;
  }
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function getNumericStackValue(result: RunGetMethodResult, index = 0): bigint | null {
  return stackItemToBigInt(result.stack[index]);
}

export function stackSliceToAddress(entry?: TonStackItem): string | null {
  if (!entry) return null;
  const [kind, value] = entry;
  if (kind !== "slice" || typeof value !== "object" || value === null) {
    return null;
  }
  const sliceBytes = (value as { bytes?: string }).bytes;
  if (!sliceBytes) return null;
  return `slice(${sliceBytes})`;
}
