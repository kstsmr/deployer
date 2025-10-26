import { listContracts } from "@/lib/survey/runSurvey";
import ContractSurveyBoard, { ClientContract } from "@/components/contract-survey-board";

function serializeContracts(): ClientContract[] {
  return listContracts().map((contract) => ({
    id: contract.id,
    title: contract.title,
    shortDescription: contract.shortDescription,
    defaultNetwork: contract.defaultNetwork,
    defaultAddress: contract.defaultAddress ?? "",
    tags: contract.tags ?? [],
    sections: contract.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      questions: section.questions.map((question) => ({
        id: question.id,
        title: question.title,
        description: question.description,
      })),
    })),
  }));
}

export default function HomePage() {
  const contracts = serializeContracts();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#0f172a,_#020617)] pb-24 pt-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        <header className="space-y-4 text-center text-balance">
          <p className="text-sm uppercase tracking-widest text-sky-300">Tact JSON-RPC survey</p>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">опросник смарт контракта ton</h1>
        </header>

        <ContractSurveyBoard contracts={contracts} />
      </div>
    </main>
  );
}
