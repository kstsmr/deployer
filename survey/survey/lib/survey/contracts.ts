import { stackItemToString } from "@/lib/survey/formatters";
import { getterQuestion, registerContracts, transactionsQuestion } from "@/lib/survey/questions";
import { ContractSurvey } from "@/lib/survey/types";
import { getNumericStackValue, stackSliceToAddress } from "@/lib/survey/utils";

const LOAN_STATUSES: Record<number, string> = {
  0: "Инициализация",
  1: "Ждём NFT",
  2: "Залог в контракте",
  3: "Кредит активен",
  4: "Возврат завершён",
  5: "Ликвидация",
};

const contracts: ContractSurvey[] = registerContracts([
  {
    id: "nft-processing",
    title: "NftProcessing",
    shortDescription:
      "Опросник для Tact-контракта залогового займа под NFT. Все вопросы читают данные напрямую через JSON-RPC.",
    defaultNetwork: "testnet",
    tags: ["tact", "loan", "nft"],
    sections: [
      {
        id: "state",
        title: "Состояние займа",
        description: "Проверяем пользовательские геттеры, объявленные в контракте.",
        questions: [
          getterQuestion({
            id: "loan-status",
            title: "Текущий статус",
            description: "Вызов get_status без промежуточных BOC файлов.",
            getter: "get_status",
            format: (result) => {
              const numeric = getNumericStackValue(result, 0);
              const statusLabel = typeof numeric === "bigint" ? LOAN_STATUSES[Number(numeric)] ?? "Неизвестно" : "Не удалось";
              return {
                headline: statusLabel,
                details: [
                  { label: "Код", value: numeric?.toString() ?? "—" },
                  { label: "Exit code", value: result.exit_code.toString() },
                ],
                raw: result,
                exitCode: result.exit_code,
              };
            },
          }),
          getterQuestion({
            id: "loan-received",
            title: "Полученная сумма",
            description: "Работает, если в контракте есть getter received_all.",
            getter: "received_all",
            format: (result) => {
              const numeric = getNumericStackValue(result, 0);
              return {
                headline: numeric ? `${numeric.toString()} nanotons` : stackItemToString(result.stack[0] ?? ["empty", ""]),
                details: result.stack.map((entry, index) => ({ label: `Stack #${index}`, value: stackItemToString(entry) })),
                raw: result,
                exitCode: result.exit_code,
              };
            },
          }),
        ],
      },
      {
        id: "participants",
        title: "Участники",
        description: "Показываем адреса владельца и кредитора, считанные напрямую из геттеров.",
        questions: [
          getterQuestion({
            id: "owner",
            title: "Текущий владелец",
            getter: "owner",
            format: (result) => {
              const address = stackSliceToAddress(result.stack[0]);
              return {
                headline: address ?? stackItemToString(result.stack[0] ?? ["empty", ""]),
                details: [
                  { label: "Stack", value: stackItemToString(result.stack[0] ?? ["empty", ""]) },
                  { label: "Exit code", value: result.exit_code.toString() },
                ],
                raw: result,
                exitCode: result.exit_code,
              };
            },
          }),
          getterQuestion({
            id: "lender",
            title: "Адрес кредитора",
            description: "Если публичный getter lender не объявлен, ответ вернётся с ошибочным exit_code.",
            getter: "lender",
            format: (result) => ({
              headline: stackItemToString(result.stack[0] ?? ["empty", ""]),
              details: result.stack.map((entry, index) => ({ label: `Stack #${index}`, value: stackItemToString(entry) })),
              raw: result,
              exitCode: result.exit_code,
            }),
          }),
        ],
      },
      {
        id: "activity",
        title: "Активность",
        description: "Берём последние транзакции через JSON-RPC getTransactions.",
        questions: [
          transactionsQuestion({
            id: "latest-transaction",
            title: "Последнее событие",
            description: "Ограничиваемся одной транзакцией, чтобы получить суть последнего действия.",
            limit: 1,
          }),
        ],
      },
    ],
  },
]);

export default contracts;
