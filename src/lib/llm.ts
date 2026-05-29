import type { ChatTurn, SearchHit } from "./types";
import { buildContextBlock } from "./retrieval";

interface GenerateAnswerInput {
  question: string;
  history: ChatTurn[];
  hits: SearchHit[];
}

const defaultModel = process.env.LLM_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const defaultBaseUrl = process.env.LLM_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

function buildAssistantPrompt(question: string, context: string) {
  return [
    "You are CodeLens Assistant, a grounded code documentation assistant.",
    "Answer only from the provided context and the user's chat history.",
    "If the context is insufficient, say exactly what is missing and suggest a follow-up search.",
    "Prefer direct, practical answers with file names and line ranges when possible.",
    "Keep the response concise but complete.",
    "",
    `Question: ${question}`,
    "",
    "Context:",
    context,
  ].join("\n");
}

function buildFallbackAnswer(question: string, hits: SearchHit[]) {
  if (!hits.length) {
    return {
      answer:
        "I could not find a strong match in the indexed documents. Try rewording the question around a file name, function, API route, or feature name.",
      provider: "fallback",
    };
  }

  const locationQuestion = /where|which file|implemented|route|endpoint|function|class/i.test(question);
  const topHits = hits.slice(0, 3);
  const lead = locationQuestion
    ? "The strongest implementation matches are"
    : "Here is the most grounded answer I could assemble from the retrieved context";

  const answer = [
    `${lead}:`,
    ...topHits.map(
      (hit) =>
        `- ${hit.chunk.documentName} (lines ${hit.chunk.lineStart}-${hit.chunk.lineEnd}): ${hit.snippet}`,
    ),
    "",
    "If you want, ask a narrower follow-up and I can focus on a specific file or symbol.",
  ].join("\n");

  return { answer, provider: "fallback" };
}

export async function generateAssistantAnswer({ question, history, hits }: GenerateAnswerInput) {
  const context = buildContextBlock(hits);
  const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return buildFallbackAnswer(question, hits);
  }

  try {
    const response = await fetch(`${defaultBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: defaultModel,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a grounded code documentation assistant. Use only the supplied context and answer with file names, line ranges, and concrete implementation details. If you are uncertain, say so.",
          },
          ...history.slice(-6).map((turn) => ({ role: turn.role, content: turn.content })),
          {
            role: "user",
            content: buildAssistantPrompt(question, context),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("LLM returned an empty response");
    }

    return {
      answer: content,
      provider: "llm",
    };
  } catch {
    return buildFallbackAnswer(question, hits);
  }
}
