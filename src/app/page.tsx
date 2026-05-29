import { AssistantShell } from "@/components/assistant-shell";
import { getDocumentSummaries } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const documents = await getDocumentSummaries();

  return (
    <AssistantShell initialDocuments={documents} />
  );
}
