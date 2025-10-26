import { formatStackResult, formatTransactionsResult } from "@/lib/survey/formatters";
import {
  ContractSurvey,
  GetterQuestionOptions,
  SurveyQuestion,
  TransactionsQuestionOptions,
} from "@/lib/survey/types";

export function getterQuestion(options: GetterQuestionOptions): SurveyQuestion {
  return {
    id: options.id,
    title: options.title,
    description: options.description,
    executor: async ({ client, address }) => {
      const result = await client.runGetMethod({ address, method: options.getter, stack: options.stack });
      if (options.format) {
        return options.format(result);
      }
      return formatStackResult(result);
    },
  };
}

export function transactionsQuestion(options: TransactionsQuestionOptions): SurveyQuestion {
  return {
    id: options.id,
    title: options.title,
    description: options.description,
    executor: async ({ client, address }) => {
      const result = await client.getTransactions({ address, limit: options.limit ?? 1 });
      if (options.format) {
        return options.format(result);
      }
      return formatTransactionsResult(result);
    },
  };
}

export function registerContracts(contracts: ContractSurvey[]): ContractSurvey[] {
  return contracts;
}
