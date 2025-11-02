import { performance } from "node:perf_hooks";

import { beginCell, Cell } from "@ton/core";

import { TonJsonRpcClient } from "@/lib/ton/jsonRpcClient";
import contracts from "@/lib/survey/contracts";
import { ContractSurvey, Network, SurveyAnswer } from "@/lib/survey/types";

export type SurveyRunResult = {
  startedAt: string;
  finishedAt: string;
  contract: { id: string; title: string };
  summaryCell: string;
};

export type SurveySummaryItem = {
  sectionId: string;
  sectionTitle: string;
  questionId: string;
  questionTitle: string;
  ok: boolean;
  value: string;
  durationMs: number;
};

export function listContracts() {
  return contracts;
}

export function getContractById(contractId: string): ContractSurvey | undefined {
  return contracts.find((contract) => contract.id === contractId);
}

export async function executeSurvey(options: {
  contract: ContractSurvey;
  address: string;
  network: Network;
  rpcUrl?: string | null;
  rpcKey?: string | null;
}): Promise<SurveyRunResult> {
  const client = new TonJsonRpcClient({
    network: options.network,
    endpointOverride: options.rpcUrl,
    apiKeyOverride: options.rpcKey,
  });

  const started = new Date();
  const summary: SurveySummaryItem[] = [];

  for (const section of options.contract.sections) {
    for (const question of section.questions) {
      const questionStart = performance.now();
      try {
        const answer = await question.executor({ address: options.address, network: options.network, client });
        const durationMs = performance.now() - questionStart;
        summary.push({
          sectionId: section.id,
          sectionTitle: section.title,
          questionId: question.id,
          questionTitle: question.title,
          ok: true,
          value: summarizeAnswer(answer),
          durationMs,
        });
      } catch (error) {
        const durationMs = performance.now() - questionStart;
        summary.push({
          sectionId: section.id,
          sectionTitle: section.title,
          questionId: question.id,
          questionTitle: question.title,
          ok: false,
          value: error instanceof Error ? error.message : "Не удалось выполнить запрос",
          durationMs,
        });
      }
    }
  }

  const summaryCell = buildSummaryCell(summary);

  return {
    startedAt: started.toISOString(),
    finishedAt: new Date().toISOString(),
    contract: { id: options.contract.id, title: options.contract.title },
    summaryCell,
  };
}

function summarizeAnswer(answer: SurveyAnswer): string {
  const parts: string[] = [];
  if (answer.headline) {
    parts.push(answer.headline);
  }
  if (answer.details?.length) {
    for (const detail of answer.details) {
      parts.push(`${detail.label}: ${detail.value}`);
    }
  }
  if (typeof answer.exitCode === "number") {
    parts.push(`Exit code: ${answer.exitCode}`);
  }
  return parts.length ? parts.join(" • ") : "—";
}

function buildSummaryCell(summary: SurveySummaryItem[]): string {
  const root = beginCell();
  root.storeUint(summary.length, 16);

  if (summary.length > 0) {
    const itemCells = summary.map((item) => buildSummaryItemCell(item));
    const listCell = chainCells(itemCells);
    root.storeRef(listCell);
  }

  return root.endCell().toBoc({ idx: false, crc32: false }).toString("base64");
}

function stringToCell(value: string): Cell {
  return beginCell().storeStringRefTail(value).endCell();
}

function buildSummaryItemCell(item: SurveySummaryItem): Cell {
  const cell = beginCell();
  cell.storeBit(item.ok);
  const duration = Math.max(0, Math.min(Math.round(item.durationMs), 0xffffffff));
  cell.storeUint(duration, 32);
  const payload = JSON.stringify({
    sectionId: item.sectionId,
    sectionTitle: item.sectionTitle,
    questionId: item.questionId,
    questionTitle: item.questionTitle,
    value: item.value,
  });
  cell.storeRef(stringToCell(payload));
  return cell.endCell();
}

function chainCells(cells: Cell[]): Cell {
  let current: Cell | null = null;
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    const node = beginCell();
    node.storeRef(cells[index]);
    if (current) {
      node.storeRef(current);
    }
    current = node.endCell();
  }
  return current ?? beginCell().endCell();
}
