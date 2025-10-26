"use client";

import { useEffect, useState } from "react";

type ArtifactState = {
  nftCollectionAddress: string | null;
  nftItemIndex: string;
  owner: string | null;
  originalOwner: string | null;
  lender: string | null;
  nft: string | null;
  loanAmount: string;
  receivedAll: string;
  nftReceived: boolean;
  status: number;
};

type ArtifactMeta = {
  hash: string;
  hashBase64: string | null;
  codeHash: string;
  dataHash: string;
  codeBoc: string;
  dataBoc: string;
  stateInitBoc: string;
  sourcePathRelative: string;
  getters: string[];
  decodedData: ArtifactState | null;
};

type DeploymentNetwork = "testnet" | "mainnet";

async function readJson(response: Response) {
  const contentType = response.headers.get("content-type");
  const body = await response.text();

  if (contentType && contentType.includes("application/json")) {
    try {
      return JSON.parse(body);
    } catch (error) {
      throw new Error(`Не удалось распарсить JSON: ${(error as Error).message}`);
    }
  }

  throw new Error(
    `Ожидался JSON, но пришёл ответ с типом "${contentType ?? "unknown"}": ${
      body.slice(0, 200)
    }${body.length > 200 ? "…" : ""}`
  );
}

export default function Home() {
  const [artifact, setArtifact] = useState<ArtifactMeta | null>(null);
  const [hashInput, setHashInput] = useState("");
  const [network, setNetwork] = useState<DeploymentNetwork>("testnet");
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setArtifactLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/contracts/nft-processing", {
          cache: "no-store",
        });
        const data = await readJson(response);
        if (!response.ok) {
          throw new Error(data.message ?? "Не удалось загрузить артефакт");
        }
        if (!cancelled) {
          setArtifact(data.artifact as ArtifactMeta);
          setHashInput((data.artifact as ArtifactMeta).hash);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Неизвестная ошибка загрузки");
        }
      } finally {
        if (!cancelled) {
          setArtifactLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePrepareDeployment = async () => {
    if (!hashInput.trim()) {
      setError("Укажите hash контракта из *.compiled.json");
      return;
    }

    setDeployLoading(true);
    setFeedback(null);
    setError(null);
    setDeployUrl(null);

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: hashInput.trim(), network }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(data.message ?? "Не удалось подготовить деплой");
      }
      setDeployUrl(data.url as string);
      setFeedback("Ссылка на деплой готова. Откройте её в Tonkeeper/Tonhub.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось подготовить деплой");
    } finally {
      setDeployLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
          <h1 className="text-3xl font-semibold tracking-tight">TON Tact Deployer</h1>
          <p className="mt-2 text-sm text-slate-300">
            Проект принимает заранее сбилженный `NftProccessing` из папки <code className="rounded bg-white/10 px-2 py-0.5">/contract</code>
            и готовит ссылку для деплоя через <code className="rounded bg-white/10 px-2 py-0.5">@tact-lang/deployer</code>.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200 shadow-inner">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-white">Артефакт</h2>
            {artifactLoading && <span className="text-xs text-slate-400">Загрузка…</span>}
          </div>

          {artifact ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Hash</p>
                <p className="font-mono text-sm break-all">{artifact.hash}</p>
              </div>
              {artifact.hashBase64 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Hash (base64)</p>
                  <p className="font-mono text-sm break-all">{artifact.hashBase64}</p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Code hash</p>
                <p className="font-mono text-sm break-all">{artifact.codeHash}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Data hash</p>
                <p className="font-mono text-sm break-all">{artifact.dataHash}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Источник</p>
                <p className="font-mono text-xs break-all">{artifact.sourcePathRelative}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Getters</p>
                <p>{artifact.getters.join(", ")}</p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-slate-400">
              Переложите <code>NftProccessing.compiled.json</code> и <code>NftProccessing.pkg</code> в папку <code>/contract</code>, а затем обновите страницу.
            </p>
          )}

          {artifact && !artifact.decodedData && (
            <p className="mt-4 text-xs text-amber-300">
              Не удалось распарсить state init — скорее всего, в билде остались заглушки адресов. Это не мешает деплою, но адреса будут заполнены после обновления build-файлов.
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-xl backdrop-blur">
          <h2 className="text-lg font-medium text-white">Готовим ссылку для деплоя</h2>
          <div className="mt-6 space-y-4">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-slate-200">Hash из *.compiled.json</span>
              <input
                value={hashInput}
                onChange={(event) => setHashInput(event.target.value)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/40"
                placeholder="e.g. e2228650..."
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-slate-200">Сеть</span>
              <select
                value={network}
                onChange={(event) => setNetwork(event.target.value as DeploymentNetwork)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/40"
              >
                <option value="testnet">Testnet</option>
                <option value="mainnet">Mainnet</option>
              </select>
            </label>

            <button
              type="button"
              onClick={handlePrepareDeployment}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition hover:from-sky-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-700"
              disabled={deployLoading || !artifact}
            >
              {deployLoading ? "Готовим…" : "Получить ссылку"}
            </button>

            {deployUrl && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                <p className="font-semibold">Ссылка готова:</p>
                <a href={deployUrl} target="_blank" rel="noreferrer" className="break-all text-emerald-100 underline">
                  {deployUrl}
                </a>
                <p className="mt-2 text-xs text-emerald-200/80">
                  Откройте ссылку в Tonkeeper/Tonhub, подпишите deploy и дождитесь включения транзакции.
                </p>
              </div>
            )}
          </div>
        </section>

        {(feedback || error) && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200 shadow-xl backdrop-blur">
            {feedback && <div className="text-emerald-300">{feedback}</div>}
            {error && <div className="text-rose-300">{error}</div>}
          </section>
        )}
      </div>
    </div>
  );
}
