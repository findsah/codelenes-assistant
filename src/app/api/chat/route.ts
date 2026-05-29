import { NextResponse } from "next/server";
import { generateAssistantAnswer } from "@/lib/llm";
import { searchChunks } from "@/lib/retrieval";
import { getStoreSnapshot } from "@/lib/storage";
import type { ChatTurn } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    question?: string;
    history?: ChatTurn[];
    documentId?: string | null;
  };

  const question = body.question?.trim();

  if (!question) {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }

  const store = await getStoreSnapshot();
  const hits = searchChunks(store.chunks, question, {
    documentId: body.documentId ?? undefined,
    limit: 5,
  });

  const response = await generateAssistantAnswer({
    question,
    history: body.history ?? [],
    hits,
  });

  return NextResponse.json({
    ...response,
    question,
    results: hits.map((hit) => ({
      documentId: hit.chunk.documentId,
      documentName: hit.chunk.documentName,
      lineStart: hit.chunk.lineStart,
      lineEnd: hit.chunk.lineEnd,
      title: hit.chunk.title,
      snippet: hit.snippet,
      score: Number(hit.score.toFixed(3)),
    })),
  });
}
