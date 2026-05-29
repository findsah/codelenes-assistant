export interface SeedDocument {
  name: string;
  mimeType: string;
  content: string;
}

export const sampleDocuments: SeedDocument[] = [
  {
    name: "apps/web/src/app/page.tsx",
    mimeType: "text/tsx",
    content: `import { DashboardShell } from "@/components/dashboard-shell";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <DashboardShell />
    </main>
  );
}
`,
  },
  {
    name: "apps/web/src/app/api/search/route.ts",
    mimeType: "text/ts",
    content: `import { NextResponse } from "next/server";
import { findProjects } from "@/lib/search-projects";

export async function POST(request: Request) {
  const { query } = await request.json();
  const results = await findProjects(query);

  return NextResponse.json({
    results,
    count: results.length,
  });
}
`,
  },
  {
    name: "apps/web/src/lib/search-projects.ts",
    mimeType: "text/ts",
    content: `export async function findProjects(query: string) {
  const normalized = query.trim().toLowerCase();

  if (normalized.includes("billing")) {
    return [
      {
        id: "billing-invoices",
        name: "Billing and invoices",
        owner: "finance-platform",
      },
    ];
  }

  return [];
}
`,
  },
  {
    name: "docs/architecture.md",
    mimeType: "text/markdown",
    content: `# Architecture

The web app keeps uploaded code snippets on disk, chunks them by file, and ranks relevant passages with a lexical search index.

The assistant can hand the retrieved context to an LLM when credentials are configured, or fall back to a grounded summary when no provider is available.
`,
  },
];
