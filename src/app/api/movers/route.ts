import { NextResponse } from "next/server";
import { loadMoversPayload, type MoversPayload } from "@/lib/movers-loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type { MoversPayload };

export async function GET() {
  const payload = await loadMoversPayload();
  const status = payload.error ? 502 : 200;
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
