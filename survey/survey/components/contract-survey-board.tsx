"use client";

import { useMemo, useState } from "react";

import { Buffer } from "buffer";
import { Cell } from "@ton/core";
import type { Slice } from "@ton/core";

import type { SurveySummaryItem } from "@/lib/survey/runSurvey";
import type { Network } from "@/lib/survey/types";

export type ClientContract = {
  id: string;
  title: string;
  shortDescription: string;
  defaultNetwork: Network;
  defaultAddress: string;
  tags: string[];
  sections: Array<{
    id: string;
    title: string;
    description?: string;
    questions: Array<{ id: string; title: string; description?: string }>;
  }>;
};

type SurveyRunResult = {
  contract: { id: string; title: string };
  summaryCell: string;
  summary: SurveySummaryItem[];
};

type ApiResponse = {
  status: "ok";
  result: { contract: { id: string; title: string }; summaryCell: string };
};

const networkLabels: Record<Network, string> = {
  mainnet: "Mainnet",
  testnet: "Testnet",
};

const statusBadge: Record<"ok" | "error", string> = {
  ok: "text-emerald-200",
  error: "text-rose-300",
};

export default function ContractSurveyBoard({ contracts }: { contracts: ClientContract[] }) {
  return (
    <div className="space-y-8">
      {contracts.map((contract) => (
        <ContractCard key={contract.id} contract={contract} />
      ))}
    </div>
  );
}

function decodeSummaryCell(summaryCell: string): SurveySummaryItem[] {
  if (!summaryCell) {
    return [];
  }

  try {
    const cells = Cell.fromBoc(Buffer.from(summaryCell, "base64"));
    if (!cells.length) {
      return [];
    }

    const slice = cells[0]!.beginParse();
    const count = Number(slice.loadUint(16));
    let listCell: Cell | null = count > 0 && slice.remainingRefs > 0 ? slice.loadRef() : null;
    const items: SurveySummaryItem[] = [];

    for (let index = 0; index < count; index += 1) {
      if (!listCell) {
        break;
      }
      const listSlice = listCell.beginParse();
      const itemCell = listSlice.loadRef();
      const itemSlice = itemCell.beginParse();
      const ok = itemSlice.loadBit();
      const durationMs = Number(itemSlice.loadUint(32));
      const payloadRaw = loadStringCell(itemSlice);
      let payload: Partial<SurveySummaryItem> = {};
      if (payloadRaw) {
        try {
          payload = JSON.parse(payloadRaw) as Partial<SurveySummaryItem>;
        } catch {
          payload = {
            value: payloadRaw,
          };
        }
      }

      items.push({
        sectionId: payload.sectionId ?? "",
        sectionTitle: payload.sectionTitle ?? "",
        questionId: payload.questionId ?? "",
        questionTitle: payload.questionTitle ?? "",
        value: payload.value ?? "",
        ok,
        durationMs,
      });

      listCell = listSlice.remainingRefs > 0 ? listSlice.loadRef() : null;
    }

    return items;
  } catch (error) {
    console.warn("[survey] failed to decode summary cell", error);
    return [];
  }
}

function loadStringCell(slice: Slice): string {
  if (slice.remainingRefs === 0) {
    return "";
  }
  try {
    const cell = slice.loadRef();
    return cell.beginParse().loadStringRefTail();
  } catch {
    return "";
  }
}

type ContractCardProps = {
  contract: ClientContract;
};

function ContractCard({ contract }: ContractCardProps) {
  const [address, setAddress] = useState(contract.defaultAddress);
  const [network, setNetwork] = useState<Network>(contract.defaultNetwork);
  const [rpcUrl, setRpcUrl] = useState("");
  const [rpcKey, setRpcKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SurveyRunResult | null>(null);

  const compactAddress = useMemo(() => {
    if (!address) return "";
    return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-6)}` : address;
  }, [address]);

  const handleRun = async () => {
    if (!address.trim()) {
      setError("Заполните адрес контракта");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: contract.id,
          address: address.trim(),
          network,
          rpcUrl: rpcUrl.trim() || undefined,
          rpcKey: rpcKey.trim() || undefined,
        }),
      });

      const data = (await response.json()) as ApiResponse & { message?: string };
      if (response.ok && data.status === "ok") {
        const summary = decodeSummaryCell(data.result.summaryCell);
        setResult({ ...data.result, summary });
      } else {
        throw new Error(data.message || "RPC вернул ошибку");
      }
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Не удалось выполнить JSON-RPC запрос");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-900/50 backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-sky-200">
            <span className="rounded-full border border-sky-400/40 px-3 py-1 text-sky-200 text-[11px]">
              {networkLabels[contract.defaultNetwork]} by default
            </span>
            {contract.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-200">
                {tag}
              </span>
            ))}
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-white">{contract.title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-300">{contract.shortDescription}</p>
        </div>
        {result && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <p className="text-xs uppercase tracking-wide text-emerald-300">Последний запуск</p>
            <p className="font-medium text-emerald-50">{compactAddress || "Адрес не задан"}</p>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          <span>Адрес контракта</span>
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="EQC..."
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-white outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-500/30"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          <span>Сеть</span>
          <select
            value={network}
            onChange={(event) => setNetwork(event.target.value as Network)}
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/30"
          >
            {Object.entries(networkLabels).map(([value, label]) => (
              <option key={value} value={value} className="bg-slate-900">
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          <span>RPC endpoint (по желанию)</span>
          <input
            value={rpcUrl}
            onChange={(event) => setRpcUrl(event.target.value)}
            placeholder="https://toncenter.com/api/v2/jsonRPC"
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-500/30"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-200">
          <span>RPC key (если нужен)</span>
          <input
            value={rpcKey}
            onChange={(event) => setRpcKey(event.target.value)}
            placeholder="X-API-Key"
            className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-500/30"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleRun}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition hover:from-sky-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Запускаем JSON-RPC…" : "Запустить опрос"}
        </button>
        <p className="text-xs text-slate-400">
          Каждый вопрос выполняется отдельным вызовом <span className="font-semibold text-slate-100">runGetMethod</span> или
          <span className="font-semibold text-slate-100"> getTransactions</span>.
        </p>
      </div>

      {error && <p className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

      <SummaryPanel summary={result?.summary ?? []} summaryCell={result?.summaryCell ?? ""} contract={contract} />
    </section>
  );
}

type SummaryPanelProps = {
  summary: SurveySummaryItem[];
  summaryCell: string;
  contract: ClientContract;
};

function SummaryPanel({ summary, summaryCell, contract }: SummaryPanelProps) {
  if (!summary.length) {
    return (
      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-slate-400">
        <p>Запустите опрос, чтобы увидеть агрегированную выдачу.</p>
      </div>
    );
  }

  const successCount = summary.filter((item) => item.ok).length;
  const errorCount = summary.length - successCount;

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Результат опроса</h3>
          <p className="text-sm text-slate-400">Все значения собраны в одну таблицу для быстрого просмотра.</p>
        </div>
        <div className="flex gap-3 text-xs uppercase tracking-wide">
          <span className="rounded-full border border-emerald-400/40 px-3 py-1 text-emerald-200">
            Успешно: {successCount}
          </span>
          {errorCount > 0 && (
            <span className="rounded-full border border-rose-400/40 px-3 py-1 text-rose-300">Ошибок: {errorCount}</span>
          )}
        </div>
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
        <p className="text-slate-200">Cell (base64):</p>
        <p className="mt-1 break-all font-mono text-[11px] text-slate-100">{summaryCell}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Раздел</th>
              <th className="px-3 py-2 text-left">Вопрос</th>
              <th className="px-3 py-2 text-left">Значение</th>
              <th className="px-3 py-2 text-left">Статус</th>
              <th className="px-3 py-2 text-left">Время</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-slate-100">
            {summary.map((item) => (
              <tr key={`${item.sectionId}:${item.questionId}`} className="align-top">
                <td className="px-3 py-3 text-xs text-slate-400">{item.sectionTitle}</td>
                <td className="px-3 py-3 whitespace-pre-wrap text-sm font-medium text-white">{item.questionTitle}</td>
                <td className="px-3 py-3 text-sm">
                  <div className="rounded-2xl border border-white/5 bg-white/5 px-3 py-2 text-slate-100/90">
                    {item.value}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs font-semibold">
                  <span className={item.ok ? statusBadge.ok : statusBadge.error}>{item.ok ? "OK" : "Ошибка"}</span>
                </td>
                <td className="px-3 py-3 text-xs text-slate-400">{item.durationMs.toFixed(0)} мс</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="text-xs text-slate-400">
        <summary className="cursor-pointer text-slate-300">JSON выдача</summary>
        <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-black/40 p-4 text-[11px] leading-relaxed text-slate-200">
          {JSON.stringify(summary, null, 2)}
        </pre>
      </details>

      <footer className="text-xs text-slate-500">
        <p>
          Источник вопросов: {contract.sections.map((section) => section.title).join(", ") || "—"}. Все значения собраны в
          одну карточку, чтобы их можно было легко скопировать или встроить в отчёт.
        </p>
      </footer>
    </div>
  );
}
