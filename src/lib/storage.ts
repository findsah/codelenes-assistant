import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chunkDocument } from "./chunk";
import { sampleDocuments } from "./sample-corpus";
import type { AssistantDocument, AssistantChunk, StoreSnapshot, DocumentSource } from "./types";

const STORE_VERSION = 1;
const DATA_DIRECTORY = path.join(process.cwd(), ".assistant-data");
const STORE_PATH = path.join(DATA_DIRECTORY, "store.json");

interface UploadInput {
  name: string;
  mimeType: string;
  text: string;
  source?: DocumentSource;
}

async function readStore(): Promise<StoreSnapshot | null> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoreSnapshot;

    if (parsed.version !== STORE_VERSION || !Array.isArray(parsed.documents) || !Array.isArray(parsed.chunks)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function writeStore(store: StoreSnapshot) {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });
  await fs.writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function createDocumentRecord(input: UploadInput): { document: AssistantDocument; chunks: AssistantChunk[] } {
  const documentId = randomUUID();
  const createdAt = new Date().toISOString();
  const chunks = chunkDocument({ documentId, documentName: input.name, text: input.text });

  return {
    document: {
      id: documentId,
      name: input.name,
      source: input.source ?? "upload",
      mimeType: input.mimeType,
      size: Buffer.byteLength(input.text, "utf8"),
      createdAt,
      chunkCount: chunks.length,
    },
    chunks,
  };
}

async function seedStore() {
  const seedEntries = sampleDocuments.map((document) =>
    createDocumentRecord({
      name: document.name,
      mimeType: document.mimeType,
      text: document.content,
      source: "sample",
    }),
  );

  const store: StoreSnapshot = {
    version: STORE_VERSION,
    documents: seedEntries.map((entry) => entry.document),
    chunks: seedEntries.flatMap((entry) => entry.chunks),
  };

  await writeStore(store);
  return store;
}

export async function loadStore() {
  const store = await readStore();
  return store ?? seedStore();
}

export async function getDocumentSummaries() {
  const store = await loadStore();
  return [...store.documents].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getStoreSnapshot() {
  return loadStore();
}

export async function addDocuments(inputs: UploadInput[]) {
  if (!inputs.length) {
    return [] as AssistantDocument[];
  }

  const store = await loadStore();
  const records = inputs.map(createDocumentRecord);

  store.documents.push(...records.map((record) => record.document));
  store.chunks.push(...records.flatMap((record) => record.chunks));

  await writeStore(store);

  return records.map((record) => record.document);
}

export async function deleteDocument(documentId: string) {
  const store = await loadStore();
  const nextDocuments = store.documents.filter((document) => document.id !== documentId);
  const nextChunks = store.chunks.filter((chunk) => chunk.documentId !== documentId);

  await writeStore({
    version: STORE_VERSION,
    documents: nextDocuments,
    chunks: nextChunks,
  });
}
