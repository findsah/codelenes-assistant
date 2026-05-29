import { createSnippet, tokenize } from "./chunk";
import type { AssistantChunk, SearchHit } from "./types";

interface SearchOptions {
  limit?: number;
  documentId?: string;
}

function boostFromTitle(title: string, queryTokens: string[]) {
  const normalizedTitle = title.toLowerCase();
  return queryTokens.reduce((boost, token) => {
    if (normalizedTitle.includes(token)) {
      return boost + 0.45;
    }

    return boost;
  }, 0);
}

export function searchChunks(chunks: AssistantChunk[], query: string, options: SearchOptions = {}) {
  const limit = options.limit ?? 5;
  const queryTokens = Array.from(new Set(tokenize(query)));
  const filteredChunks = options.documentId
    ? chunks.filter((chunk) => chunk.documentId === options.documentId)
    : chunks;

  if (!queryTokens.length || !filteredChunks.length) {
    return [] as SearchHit[];
  }

  const documentFrequency = new Map<string, number>();
  const chunkTokens = new Map<string, string[]>();

  for (const chunk of filteredChunks) {
    const tokens = Array.from(new Set(tokenize(`${chunk.documentName}\n${chunk.title}\n${chunk.content}`)));
    chunkTokens.set(chunk.id, tokens);

    for (const token of tokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const totalChunks = filteredChunks.length;

  const scored = filteredChunks.map((chunk) => {
    const tokens = chunkTokens.get(chunk.id) ?? [];
    const tokenSet = new Set(tokens);
    const lowerContent = chunk.content.toLowerCase();
    const lowerName = chunk.documentName.toLowerCase();
    const lowerTitle = chunk.title.toLowerCase();

    let score = 0;

    for (const token of queryTokens) {
      if (!tokenSet.has(token)) {
        continue;
      }

      const docFrequency = documentFrequency.get(token) ?? 0;
      const inverseDocumentFrequency = Math.log(1 + totalChunks / (1 + docFrequency));
      const occurrences = tokens.filter((value) => value === token).length;

      score += inverseDocumentFrequency * (1 + occurrences * 0.25);
    }

    if (queryTokens.some((token) => lowerName.includes(token))) {
      score += 0.8;
    }

    if (queryTokens.some((token) => lowerTitle.includes(token))) {
      score += 0.5;
    }

    if (query.trim().length > 3 && lowerContent.includes(query.toLowerCase().trim())) {
      score += 1.25;
    }

    score += boostFromTitle(chunk.title, queryTokens);

    return {
      chunk,
      score,
      snippet: createSnippet(chunk.content, queryTokens),
    } satisfies SearchHit;
  });

  return scored
    .filter((hit) => hit.score > 0)
    .sort((left, right) => right.score - left.score || left.chunk.documentName.localeCompare(right.chunk.documentName))
    .slice(0, limit);
}

export function buildContextBlock(hits: SearchHit[]) {
  if (!hits.length) {
    return "No relevant context was found in the indexed documents.";
  }

  return hits
    .map(
      (hit, index) =>
        `[#${index + 1}] ${hit.chunk.documentName} (lines ${hit.chunk.lineStart}-${hit.chunk.lineEnd})\n${hit.chunk.content}`,
    )
    .join("\n\n---\n\n");
}
