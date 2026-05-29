import type { AssistantChunk } from "./types";

interface ChunkInput {
  documentId: string;
  documentName: string;
  text: string;
}

const DEFAULT_MAX_CHARS = 1100;

function normalizeForSearch(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

function estimateTitle(lines: string[], documentName: string) {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith("#")) {
      return trimmed.replace(/^#+\s*/, "");
    }

    return trimmed.slice(0, 80);
  }

  return documentName;
}

export function chunkDocument({ documentId, documentName, text }: ChunkInput): AssistantChunk[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const chunks: AssistantChunk[] = [];
  let buffer: string[] = [];
  let startLine = 1;

  const flush = (endLine: number) => {
    const content = buffer.join("\n").trim();

    if (!content) {
      return;
    }

    chunks.push({
      id: `${documentId}:${chunks.length + 1}`,
      documentId,
      documentName,
      lineStart: startLine,
      lineEnd: endLine,
      title: estimateTitle(buffer, documentName),
      content,
    });
  };

  lines.forEach((line, index) => {
    buffer.push(line);

    const contentLength = buffer.join("\n").length;
    const lineCount = index + 1 - startLine + 1;
    const isSoftBreak = line.trim() === "" && buffer.length > 4;

    if (contentLength >= DEFAULT_MAX_CHARS || (isSoftBreak && lineCount >= 8)) {
      flush(index + 1);
      buffer = [];
      startLine = index + 2;
    }
  });

  flush(lines.length);

  return chunks.map((chunk) => ({
    ...chunk,
    title: normalizeForSearch(chunk.title) === "" ? documentName : chunk.title,
  }));
}

export function tokenize(value: string) {
  return normalizeForSearch(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function createSnippet(content: string, queryTokens: string[], maxLength = 260) {
  const normalizedContent = normalizeForSearch(content);
  let bestIndex = 0;

  for (const token of queryTokens) {
    const candidateIndex = normalizedContent.indexOf(token);
    if (candidateIndex >= 0) {
      bestIndex = candidateIndex;
      break;
    }
  }

  const start = Math.max(0, bestIndex - Math.floor(maxLength / 3));
  const end = Math.min(content.length, start + maxLength);
  const snippet = content.slice(start, end).trim();

  if (start > 0) {
    return `...${snippet}`;
  }

  if (end < content.length) {
    return `${snippet}...`;
  }

  return snippet;
}
