import { currentSession, type SessionInfo } from "./session";
import {
  enrichWithBriefs,
  fetchExtendedQuotes,
  fetchMovers,
  rowsToExtendedMovers,
  rowsToMovers,
  type Mover,
} from "./webull";

export type MoversPayload = {
  session: SessionInfo;
  gainers: Mover[];
  losers: Mover[];
  fetchedAt: string;
  dataAsOf: string | null;
  error?: string;
};

const FILTERS = { minPrice: 35, minPct: 4, limit: 25 };
// Pre/post market genuinely has fewer big movers, especially early. Keep the list
// populated by dropping the 4% floor to a tiny epsilon (still excludes untraded,
// flat names) and let the magnitude sort surface the biggest moves first.
const EXTENDED_FILTERS = { minPrice: 35, minPct: 0.01, limit: 25 };

export async function loadMoversPayload(): Promise<MoversPayload> {
  const session = currentSession();
  const fetchedAt = new Date().toISOString();
  try {
    const [gainersRes, losersRes] = await Promise.all([
      fetchMovers(session.rankType, "gainers", 200),
      fetchMovers(session.rankType, "losers", 200),
    ]);

    let gainersList: Mover[];
    let losersList: Mover[];
    let dataAsOf: string | null;

    // During pre/post market the ranking `values` snapshot is stale (it freezes at
    // the prior session close), so re-quote every candidate for the live
    // extended-hours price and move. A real pre-market mover can sit in either
    // ranking list, so we pool both lists and let the live move decide the side.
    if (session.session === "pre" || session.session === "after") {
      const combinedRows = [...gainersRes.rows, ...losersRes.rows];
      const ids = [...new Set(combinedRows.map((r) => r.ticker.tickerId))];
      const quotes = await fetchExtendedQuotes(ids);
      gainersList = rowsToExtendedMovers(combinedRows, quotes, "gainers", EXTENDED_FILTERS);
      losersList = rowsToExtendedMovers(combinedRows, quotes, "losers", EXTENDED_FILTERS);
      dataAsOf = fetchedAt; // live quotes, fetched just now
    } else {
      gainersList = rowsToMovers(gainersRes.rows, "gainers", FILTERS);
      losersList = rowsToMovers(losersRes.rows, "losers", FILTERS);
      const latestUpdateMs = Math.max(gainersRes.latestUpdateMs ?? 0, losersRes.latestUpdateMs ?? 0);
      dataAsOf = latestUpdateMs ? new Date(latestUpdateMs).toISOString() : null;
    }

    const [gainers, losers] = await Promise.all([
      enrichWithBriefs(gainersList),
      enrichWithBriefs(losersList),
    ]);
    return {
      session,
      gainers,
      losers,
      fetchedAt,
      dataAsOf,
    };
  } catch (err) {
    return {
      session,
      gainers: [],
      losers: [],
      fetchedAt,
      dataAsOf: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
