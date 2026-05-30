"use client";

import { useMemo, useState } from "react";
import type { AssistantDocument, ChatTurn } from "@/lib/types";

type ChatMessage = ChatTurn & {
  provider?: string;
  results?: Array<{
    documentId: string;
    documentName: string;
    lineStart: number;
    lineEnd: number;
    title: string;
    snippet: string;
    score: number;
  }>;
};

interface AssistantShellProps {
  initialDocuments: AssistantDocument[];
}

const starterPrompts = [
  "Where is the API search route implemented?",
  "What does the indexer do with uploaded files?",
  "Summarize the architecture in this codebase.",
  "Which file should I inspect to change retrieval behavior?",
];

function fileBadge(source: AssistantDocument["source"]) {
  return source === "sample" ? "Sample" : "Upload";
}

export function AssistantShell({ initialDocuments }: AssistantShellProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Drop in a codebase or text files, then ask where a feature is implemented, how data flows, or which file to edit. I will answer from the indexed context and cite the strongest passages.",
      provider: "seed",
    },
  ]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const focusedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );

  const stats = useMemo(() => {
    const sampleCount = documents.filter((document) => document.source === "sample").length;
    return {
      total: documents.length,
      uploads: documents.length - sampleCount,
      samples: sampleCount,
    };
  }, [documents]);

  async function refreshDocuments(nextSelectedId?: string | null) {
    const response = await fetch("/api/documents", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Failed to refresh documents");
    }

    const data = (await response.json()) as {
      documents: AssistantDocument[];
    };

    setDocuments(data.documents);
    setSelectedDocumentId((current) => nextSelectedId ?? current);
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;

    if (!fileList?.length) {
      return;
    }

    setIsUploading(true);
    setStatus(null);

    try {
      const formData = new FormData();

      Array.from(fileList).forEach((file) => formData.append("files", file));

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorPayload?.error ?? "Upload failed.");
      }

      const data = (await response.json()) as { documents: AssistantDocument[]; message: string };

      await refreshDocuments(data.documents[0]?.id ?? selectedDocumentId);
      setStatus(data.message);
      event.target.value = "";
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Upload failed. Text/code files and most PDFs are supported in this demo.";
      setStatus(message);
    } finally {
      setIsUploading(false);
    }
  }

  async function sendQuestion(nextQuestion?: string) {
    const trimmedQuestion = (nextQuestion ?? question).trim();

    if (!trimmedQuestion || isSending) {
      return;
    }

    const nextHistory: ChatTurn[] = messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: trimmedQuestion,
      },
    ]);
    setQuestion("");
    setIsSending(true);
    setStatus(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          history: nextHistory,
          documentId: selectedDocumentId,
        }),
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const data = (await response.json()) as {
        answer: string;
        provider: string;
        results: ChatMessage["results"];
      };

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer,
          provider: data.provider,
          results: data.results,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "The assistant could not complete the request. Check the dev console or try a shorter question.",
          provider: "error",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function removeDocument(documentId: string) {
    const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setStatus("Could not remove that document.");
      return;
    }

    const nextDocuments = documents.filter((document) => document.id !== documentId);
    setDocuments(nextDocuments);

    if (selectedDocumentId === documentId) {
      setSelectedDocumentId(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(103,232,249,0.16),_transparent_28%),radial-gradient(circle_at_80%_18%,_rgba(251,191,36,0.12),_transparent_24%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(160,191,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(160,191,255,0.06)_1px,transparent_1px)] bg-[size:28px_28px] opacity-30" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 lg:h-[calc(100vh-3rem)] lg:flex-row">
        <aside className="flex w-full flex-col gap-5 rounded-[28px] border border-border/70 bg-panel/90 p-5 shadow-[0_20px_80px_rgba(2,8,23,0.45)] backdrop-blur-xl lg:w-[365px] lg:shrink-0">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              Code documentation assistant
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Ask your codebase where, why, and how.
              </h1>
              <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
                Load a repository or text files, then query implementation details, API routes,
                dependencies, and behavior with grounded citations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border/70 bg-panel-strong/90 p-4">
            <StatCard label="Docs" value={stats.total.toString()} />
            <StatCard label="Uploads" value={stats.uploads.toString()} />
            <StatCard label="Seed" value={stats.samples.toString()} />
          </div>

          <label className="group flex cursor-pointer flex-col gap-3 rounded-3xl border border-dashed border-accent/35 bg-white/5 p-4 transition hover:border-accent/60 hover:bg-white/8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Import files</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Plain text, markdown, JSON, source files, and PDF documents are supported.
                </p>
              </div>
              <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                {isUploading ? "Indexing" : "Upload"}
              </span>
            </div>
            <input
              accept=".ts,.tsx,.js,.jsx,.json,.md,.txt,.py,.go,.rs,.java,.c,.cpp,.cs,.yml,.yaml,.toml,.pdf,application/pdf"
              multiple
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <p className="font-semibold text-foreground">Indexed documents</p>
              <button
                type="button"
                onClick={() => setSelectedDocumentId(null)}
                className="text-xs font-medium text-accent transition hover:text-white"
              >
                Clear focus
              </button>
            </div>

            <div className="max-h-[280px] space-y-2 overflow-auto pr-1">
              {documents.map((document) => {
                const isSelected = document.id === selectedDocumentId;

                return (
                  <div
                    key={document.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setSelectedDocumentId((current) => (current === document.id ? null : document.id))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedDocumentId((current) => (current === document.id ? null : document.id));
                      }
                    }}
                    className={`w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-accent/60 bg-accent/10 text-foreground"
                        : "border-border/70 bg-white/4 text-muted hover:border-border hover:bg-white/7"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{document.name}</p>
                        <p className="mt-1 text-xs text-muted">
                          {fileBadge(document.source)} · {document.chunkCount} chunk
                          {document.chunkCount === 1 ? "" : "s"} · {Math.ceil(document.size / 1024)} KB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeDocument(document.id);
                        }}
                        className="rounded-full border border-border/80 px-2 py-1 text-[11px] font-medium text-muted transition hover:border-red-400/40 hover:text-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-panel-strong/90 p-4">
            <p className="text-sm font-semibold text-foreground">Focus</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {focusedDocument
                ? `Questions will be narrowed to ${focusedDocument.name}.`
                : "No single document is selected, so retrieval spans the whole indexed corpus."}
            </p>
          </div>

          {status ? (
            <div className="rounded-2xl border border-accent/20 bg-accent/10 p-3 text-sm text-accent">
              {status}
            </div>
          ) : null}
        </aside>

        <main className="flex min-h-[72vh] flex-1 flex-col rounded-[28px] border border-border/70 bg-panel/85 shadow-[0_20px_80px_rgba(2,8,23,0.38)] backdrop-blur-xl lg:min-h-0">
          <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-accent">Grounded retrieval</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                Chat interface with citations and implementation hints.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                The assistant searches stored chunks, extracts the strongest matches, and can call
                an OpenAI-compatible model when credentials are configured. Without a provider, it
                still returns a grounded summary from retrieved context.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendQuestion(prompt)}
                  className="rounded-full border border-border/70 bg-white/5 px-4 py-2 text-xs font-medium text-foreground transition hover:border-accent/50 hover:bg-accent/10"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-auto px-5 py-5 sm:px-6">
            {messages.map((message, index) => {
              const isUser = message.role === "user";

              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[min(780px,100%)] rounded-[28px] border px-5 py-4 shadow-lg ${
                      isUser
                        ? "border-accent/25 bg-accent/12 text-foreground"
                        : "border-border/70 bg-white/5 text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                        {isUser ? "You" : message.provider === "llm" ? "LLM answer" : "Grounded answer"}
                      </p>
                      {message.provider ? (
                        <span className="rounded-full border border-border/70 px-2.5 py-1 text-[11px] text-muted">
                          {message.provider}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-foreground">
                      {message.content}
                    </p>

                    {message.results?.length ? (
                      <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          Sources
                        </p>
                        <div className="space-y-2">
                          {message.results.map((result) => (
                            <div
                              key={`${result.documentId}-${result.lineStart}-${result.lineEnd}`}
                              className="rounded-2xl border border-border/60 bg-slate-950/40 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <p className="text-sm font-medium text-foreground">{result.documentName}</p>
                                <p className="text-[11px] text-muted">
                                  lines {result.lineStart}-{result.lineEnd} · score {result.score}
                                </p>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-muted">{result.snippet}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border/60 px-5 py-5 sm:px-6">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendQuestion();
              }}
              className="flex flex-col gap-3 rounded-[24px] border border-border/70 bg-white/5 p-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  Ask a question
                </label>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="For example: Where is the search route implemented?"
                  rows={3}
                  className="min-h-[88px] w-full resize-none rounded-2xl border border-border/70 bg-slate-950/40 px-4 py-3 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted focus:border-accent/60"
                />
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-accent-2 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? "Thinking..." : "Send question"}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-slate-950/35 px-3 py-3 text-center">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
    </div>
  );
}
