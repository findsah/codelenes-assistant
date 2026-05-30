import { NextResponse } from "next/server";
import { addDocuments, getDocumentSummaries, getStoreSnapshot } from "@/lib/storage";

export const runtime = "nodejs";

async function extractFileText(file: File) {
  const mimeType = file.type || "text/plain";
  const lowerName = file.name.toLowerCase();

  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const { default: pdfParse } = (await import("pdf-parse/lib/pdf-parse.js")) as {
      default: (data: Buffer) => Promise<{ text: string }>;
    };
    const parsed = await pdfParse(bytes);
    return {
      mimeType,
      text: parsed.text.trim(),
    };
  }

  return {
    mimeType,
    text: (await file.text()).trim(),
  };
}

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

  let inputs;

  try {
    inputs = await Promise.all(
      files.map(async (file) => {
        const extracted = await extractFileText(file);

        if (!extracted.text) {
          throw new Error(`No readable text found in ${file.name}.`);
        }

        return {
          name: file.name,
          mimeType: extracted.mimeType,
          text: extracted.text,
        };
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process uploaded files.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const documents = await addDocuments(inputs);

  return NextResponse.json({
    documents,
    message: `Indexed ${documents.length} file${documents.length === 1 ? "" : "s"}.`,
  });
}
