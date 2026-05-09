import { NextResponse } from "next/server";
import { currentSession } from "@/lib/session";
import { fetchTopGainers, rowsToMovers, type Mover } from "@/lib/webull";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type MoversPayload = {
  session: ReturnType<typeof currentSession>;
  movers: Mover[];
  fetchedAt: string;
  dataAsOf: string | null;
  error?: string;
};

export async function GET() {
  const session = currentSession();
  try {
    const { rows, latestUpdateMs } = await fetchTopGainers(session.rankType, 200);
    const movers = rowsToMovers(rows, session.rankType, {
      minPrice: 5,
      minPct: 4,
      limit: 50,
    });
    const payload: MoversPayload = {
      session,
      movers,
      fetchedAt: new Date().toISOString(),
      dataAsOf: latestUpdateMs ? new Date(latestUpdateMs).toISOString() : null,
    };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        session,
        movers: [],
        fetchedAt: new Date().toISOString(),
        dataAsOf: null,
        error: message,
      } satisfies MoversPayload,
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
