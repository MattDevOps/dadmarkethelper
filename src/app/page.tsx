import { currentSession } from "@/lib/session";
import { fetchTopGainers, rowsToMovers } from "@/lib/webull";
import type { MoversPayload } from "./api/movers/route";
import MoversView from "./MoversView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadInitial(): Promise<MoversPayload> {
  const session = currentSession();
  try {
    const { rows, latestUpdateMs } = await fetchTopGainers(session.rankType, 200);
    const movers = rowsToMovers(rows, session.rankType, {
      minPrice: 5,
      minPct: 4,
      limit: 50,
    });
    return {
      session,
      movers,
      fetchedAt: new Date().toISOString(),
      dataAsOf: latestUpdateMs ? new Date(latestUpdateMs).toISOString() : null,
    };
  } catch (err) {
    return {
      session,
      movers: [],
      fetchedAt: new Date().toISOString(),
      dataAsOf: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export default async function Home() {
  const initial = await loadInitial();
  return <MoversView initial={initial} />;
}
