export type DocumentSource = "sample" | "upload";

export interface AssistantDocument {
  id: string;
  name: string;
  source: DocumentSource;
  mimeType: string;
  size: number;
  createdAt: string;
  chunkCount: number;
}

export interface AssistantChunk {
  id: string;
  documentId: string;
  documentName: string;
  lineStart: number;
  lineEnd: number;
  title: string;
  content: string;
}

export interface StoreSnapshot {
  version: number;
  documents: AssistantDocument[];
  chunks: AssistantChunk[];
}

export interface SearchHit {
  chunk: AssistantChunk;
  score: number;
  snippet: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}
