import { TonJsonRpcClient, TonStackItem, RunGetMethodResult, TonTransaction } from "@/lib/ton/jsonRpcClient";

export type Network = "mainnet" | "testnet";

export type SurveyAnswerDetail = {
  label: string;
  value: string;
};

export type SurveyAnswer = {
  headline: string;
  details?: SurveyAnswerDetail[];
  raw?: unknown;
  exitCode?: number;
};

export type SurveyExecutionContext = {
  address: string;
  network: Network;
  client: TonJsonRpcClient;
};

export type SurveyQuestionExecutor = (
  context: SurveyExecutionContext
) => Promise<SurveyAnswer>;

export type SurveyQuestion = {
  id: string;
  title: string;
  description?: string;
  executor: SurveyQuestionExecutor;
};

export type SurveySection = {
  id: string;
  title: string;
  description?: string;
  questions: SurveyQuestion[];
};

export type ContractSurvey = {
  id: string;
  title: string;
  shortDescription: string;
  defaultNetwork: Network;
  defaultAddress?: string;
  tags?: string[];
  sections: SurveySection[];
};

export type GetterQuestionOptions = {
  id: string;
  title: string;
  description?: string;
  getter: string;
  stack?: TonStackItem[];
  format?: (result: RunGetMethodResult) => SurveyAnswer;
};

export type TransactionsQuestionOptions = {
  id: string;
  title: string;
  description?: string;
  limit?: number;
  format?: (txs: TonTransaction[]) => SurveyAnswer;
};
