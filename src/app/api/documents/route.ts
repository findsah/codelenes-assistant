import { NextResponse } from "next/server";
import { addDocuments, getDocumentSummaries, getStoreSnapshot } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const [documents, store] = await Promise.all([getDocumentSummaries(), getStoreSnapshot()]);

  return NextResponse.json({
    documents,
    stats: {
      documentCount: store.documents.length,
      chunkCount: store.chunks.length,
    },
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (!files.length) {
    return NextResponse.json({ error: "No files were provided." }, { status: 400 });
  }

  const inputs = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      mimeType: file.type || "text/plain",
      text: await file.text(),
    })),
  );

  const documents = await addDocuments(inputs);

  return NextResponse.json({
    documents,
    message: `Indexed ${documents.length} file${documents.length === 1 ? "" : "s"}.`,
  });
}
