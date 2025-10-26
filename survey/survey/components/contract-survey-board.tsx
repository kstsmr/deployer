"use client";

import { useMemo, useState } from "react";

import type { Network, SurveyAnswer } from "@/lib/survey/types";

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
  sections: Array<{
    id: string;
    title: string;
    description?: string;
    questions: Array<{
      id: string;
      title: string;
      ok: boolean;
      answer?: SurveyAnswer;
      error?: string;
      durationMs: number;
    }>;
  }>;
};

type ApiResponse = {
  status: "ok";
  result: SurveyRunResult;
};

const networkLabels: Record<Network, string> = {
  mainnet: "Mainnet",
  testnet: "Testnet",
};

const badgeColors: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20",
  error: "bg-rose-500/15 text-rose-200 border-rose-400/20",
  idle: "bg-slate-500/15 text-slate-300 border-white/10",
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

type ContractCardProps = {
  contract: ClientContract;
};

type QuestionResult = SurveyRunResult["sections"][number]["questions"][number];

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
        setResult(data.result);
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

      <div className="mt-6 space-y-6">
        {contract.sections.map((section) => (
          <QuestionSection
            key={section.id}
            section={section}
            result={result?.sections.find((candidate) => candidate.id === section.id)}
          />
        ))}
      </div>
    </section>
  );
}

type SectionProps = {
  section: ClientContract["sections"][number];
  result?: SurveyRunResult["sections"][number];
};

function QuestionSection({ section, result }: SectionProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{section.title}</h3>
          {section.description && <p className="text-sm text-slate-400">{section.description}</p>}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs ${result ? badgeColors.success : badgeColors.idle}`}>
          {result ? "Ответ получен" : "В ожидании запуска"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {section.questions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            result={result?.questions.find((candidate) => candidate.id === question.id)}
          />
        ))}
      </div>
    </div>
  );
}

type QuestionCardProps = {
  question: ClientContract["sections"][number]["questions"][number];
  result?: QuestionResult;
};

function QuestionCard({ question, result }: QuestionCardProps) {
  const status = result ? (result.ok ? "success" : "error") : "idle";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium text-white">{question.title}</p>
          {question.description && <p className="text-sm text-slate-400">{question.description}</p>}
        </div>
        <span className={`self-start rounded-full border px-3 py-1 text-xs ${badgeColors[status]}`}>
          {status === "idle" && "Ждёт JSON-RPC"}
          {status === "success" && `Код ${result?.answer?.exitCode ?? 0}`}
          {status === "error" && "Ошибка"}
        </span>
      </div>

      {result ? (
        result.ok && result.answer ? (
          <div className="mt-3 space-y-3">
            <p className="text-lg font-semibold text-white">{result.answer.headline}</p>
            {result.answer.details?.length ? (
              <dl className="grid gap-1 text-sm text-slate-300">
                {result.answer.details.map((detail) => (
                  <div key={detail.label} className="flex flex-wrap justify-between gap-2">
                    <dt className="text-slate-400">{detail.label}</dt>
                    <dd className="text-slate-100 text-right font-mono text-xs break-all">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {result.answer.raw && (
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer text-slate-400">Ответ с консоли</summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-black/50 p-3 text-[11px] leading-relaxed text-slate-300">
                  {JSON.stringify(result.answer.raw, null, 2)}
                </pre>
              </details>
            )}
            <p className="text-xs text-slate-500">Время запроса: {result.durationMs.toFixed(0)} мс</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-rose-300">{result.error || "JSON-RPC ответил ошибочным кодом"}</p>
        )
      ) : (
        <p className="mt-3 text-xs text-slate-500">Ожидает запуска.</p>
      )}
    </div>
  );
}
