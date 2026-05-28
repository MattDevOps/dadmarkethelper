import { currentSession, type SessionInfo } from "./session";
import { enrichWithBriefs, fetchMovers, rowsToMovers, type Mover } from "./webull";

export type MoversPayload = {
  session: SessionInfo;
  gainers: Mover[];
  losers: Mover[];
  fetchedAt: string;
  dataAsOf: string | null;
  error?: string;
};

const FILTERS = { minPrice: 35, minPct: 4, limit: 25 };

export async function loadMoversPayload(): Promise<MoversPayload> {
  const session = currentSession();
  try {
    const [gainersRes, losersRes] = await Promise.all([
      fetchMovers(session.rankType, "gainers", 200),
      fetchMovers(session.rankType, "losers", 200),
    ]);
    const gainersList = rowsToMovers(gainersRes.rows, "gainers", FILTERS);
    const losersList = rowsToMovers(losersRes.rows, "losers", FILTERS);
    const [gainers, losers] = await Promise.all([
      enrichWithBriefs(gainersList),
      enrichWithBriefs(losersList),
    ]);
    const latestUpdateMs = Math.max(gainersRes.latestUpdateMs ?? 0, losersRes.latestUpdateMs ?? 0);
    return {
      session,
      gainers,
      losers,
      fetchedAt: new Date().toISOString(),
      dataAsOf: latestUpdateMs ? new Date(latestUpdateMs).toISOString() : null,
    };
  } catch (err) {
    return {
      session,
      gainers: [],
      losers: [],
      fetchedAt: new Date().toISOString(),
      dataAsOf: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
