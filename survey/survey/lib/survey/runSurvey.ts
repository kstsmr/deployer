import { performance } from "node:perf_hooks";

import { TonJsonRpcClient } from "@/lib/ton/jsonRpcClient";
import contracts from "@/lib/survey/contracts";
import { ContractSurvey, Network, SurveyAnswer } from "@/lib/survey/types";

export type QuestionResult = {
  id: string;
  title: string;
  ok: boolean;
  answer?: SurveyAnswer;
  error?: string;
  durationMs: number;
};

export type SectionResult = {
  id: string;
  title: string;
  description?: string;
  questions: QuestionResult[];
};

export type SurveyRunResult = {
  startedAt: string;
  finishedAt: string;
  contract: { id: string; title: string };
  sections: SectionResult[];
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
  const sections: SectionResult[] = [];

  for (const section of options.contract.sections) {
    const questionResults: QuestionResult[] = [];
    for (const question of section.questions) {
      const questionStart = performance.now();
      try {
        const answer = await question.executor({ address: options.address, network: options.network, client });
        questionResults.push({
          id: question.id,
          title: question.title,
          ok: true,
          answer,
          durationMs: performance.now() - questionStart,
        });
      } catch (error) {
        questionResults.push({
          id: question.id,
          title: question.title,
          ok: false,
          error: error instanceof Error ? error.message : "Не удалось выполнить запрос",
          durationMs: performance.now() - questionStart,
        });
      }
    }
    sections.push({ id: section.id, title: section.title, description: section.description, questions: questionResults });
  }

  return {
    startedAt: started.toISOString(),
    finishedAt: new Date().toISOString(),
    contract: { id: options.contract.id, title: options.contract.title },
    sections,
  };
}
