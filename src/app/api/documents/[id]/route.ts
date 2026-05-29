import { NextResponse } from "next/server";
import { deleteDocument } from "@/lib/storage";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await deleteDocument(id);

  return NextResponse.json({ ok: true });
}
