import { RunGetMethodResult, TonStackItem, TonTransaction } from "@/lib/ton/jsonRpcClient";
import { SurveyAnswer, SurveyAnswerDetail } from "@/lib/survey/types";

const TON_DECIMALS = 1_000_000_000n;

export function formatStackResult(result: RunGetMethodResult): SurveyAnswer {
  return {
    headline: stackItemToString(result.stack[0] ?? ["empty", ""]),
    details: result.stack.map((entry, index) => ({
      label: `Stack #${index}`,
      value: stackItemToString(entry),
    })),
    raw: result,
    exitCode: result.exit_code,
  };
}

export function stackItemToString(entry: TonStackItem): string {
  const [kind, value] = entry;

  if (kind === "num" && typeof value === "string") {
    return formatNumber(value);
  }

  if ((kind === "cell" || kind === "slice" || kind === "builder") && typeof value === "object" && value) {
    const bytes = (value as { bytes?: string }).bytes;
    if (bytes) {
      return `${kind}(${bytes})`;
    }
  }

  if ((kind === "tuple" || kind === "list") && isIterableStack(value)) {
    const items = Array.isArray(value) ? value : (value.elements as unknown[]) ?? [];
    return `${kind}[${items
      .map((item) => (Array.isArray(item) ? stackItemToString(item as TonStackItem) : normalizePrimitive(item)))
      .join(", ")}]`;
  }

  return normalizePrimitive(value);
}

export function formatNumber(hexOrDecimal: string): string {
  if (!hexOrDecimal) {
    return "0";
  }
  if (!hexOrDecimal.startsWith("0x") && !hexOrDecimal.startsWith("-0x")) {
    return hexOrDecimal;
  }
  try {
    const value = BigInt(hexOrDecimal);
    return `${value.toString()} (${hexOrDecimal})`;
  } catch {
    return hexOrDecimal;
  }
}

export function formatTonValue(value: bigint): string {
  const negative = value < 0;
  const abs = negative ? -value : value;
  const tons = abs / TON_DECIMALS;
  const nanos = abs % TON_DECIMALS;
  const fractional = nanos.toString().padStart(9, "0").replace(/0+$/, "");
  const amount = fractional.length ? `${tons}.${fractional}` : tons.toString();
  return `${negative ? "-" : ""}${amount} TON`;
}

export function formatTimestamp(utime?: number): string {
  if (!utime) return "—";
  const date = new Date(utime * 1000);
  return `${date.toLocaleString()}`;
}

export function formatTransactionsResult(txs: TonTransaction[]): SurveyAnswer {
  if (!txs.length) {
    return {
      headline: "Нет транзакций",
      details: [{ label: "Совет", value: "Контракт ещё ни разу не взаимодействовал с сетью" }],
      raw: txs,
    };
  }

  const [latest] = txs;
  const details: SurveyAnswerDetail[] = [];
  if (latest.in_msg?.source) {
    details.push({ label: "Отправитель", value: latest.in_msg.source });
  }
  if (latest.in_msg?.value) {
    try {
      const rawValue = latest.in_msg.value;
      const value = rawValue.startsWith("0x") ? BigInt(rawValue) : BigInt(rawValue);
      details.push({ label: "Сумма", value: formatTonValue(value) });
    } catch {
      details.push({ label: "Сумма", value: latest.in_msg.value });
    }
  }
  if (latest.transaction_id?.lt) {
    details.push({ label: "Logical time", value: latest.transaction_id.lt });
  }
  if (latest.transaction_id?.hash) {
    details.push({ label: "Hash", value: latest.transaction_id.hash });
  }

  return {
    headline: `Последняя активность: ${formatTimestamp(latest.utime)}`,
    details,
    raw: txs,
  };
}

function normalizePrimitive(value: unknown): string {
  if (value === null || typeof value === "undefined") {
    return "—";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function isIterableStack(value: unknown): value is { elements?: unknown[] } | unknown[] {
  if (!value) return false;
  if (Array.isArray(value)) return true;
  return typeof value === "object" && "elements" in (value as Record<string, unknown>);
}
