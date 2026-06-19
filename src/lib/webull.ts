import type { RankType } from "./session";

export type Side = "gainers" | "losers";

export type Mover = {
  tickerId: number;
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  changePct: number;
  changeAbs: number;
  prevClose: number;
  volume: number;
  description?: string;
  industry?: string;
};

type WebullTicker = {
  tickerId: number;
  symbol: string;
  name: string;
  disExchangeCode?: string;
  exchangeCode?: string;
  preClose?: string;
  close?: string;
  pprice?: string;
  volume?: string;
};

type WebullRow = {
  ticker: WebullTicker;
  values: { price?: string; change?: string; changeRatio?: string };
};

type WebullResponse = {
  data?: WebullRow[];
  hasMore?: boolean;
  latestUpdateTime?: number;
};

type WebullBriefResponse = {
  companyBrief?: {
    introduce?: string;
    industry?: string;
  };
};

// Real-time quote row from the batch realtime endpoint. During extended hours
// (pre/post market) `pPrice`/`pChRatio`/`pChange` carry the live extended-hours
// quote relative to the regular-session close.
type WebullRealtimeQuote = {
  tickerId: number;
  close?: string;
  pPrice?: string;
  pChRatio?: string;
  pChange?: string;
};

export type LiveQuote = {
  price: number; // extended-hours price (pPrice), falling back to regular close
  changePct: number; // extended-hours move vs regular close, in percent
  changeAbs: number;
  prevClose: number; // regular-session close
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function fetchMovers(
  rankType: RankType,
  side: Side,
  pageSize = 200,
): Promise<{ rows: WebullRow[]; latestUpdateMs: number | null }> {
  const direction = side === "gainers" ? -1 : 1;
  const url = `https://quotes-gw.webullfintech.com/api/wlas/ranking/topGainers?regionId=6&rankType=${rankType}&pageSize=${pageSize}&pageIndex=1&direction=${direction}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Webull HTTP ${res.status}`);
  const json = (await res.json()) as WebullResponse;
  return { rows: json.data ?? [], latestUpdateMs: json.latestUpdateTime ?? null };
}

function parseFloatOr(value: string | undefined, fallback = 0): number {
  if (value == null) return fallback;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export function rowsToMovers(
  rows: WebullRow[],
  side: Side,
  opts: { minPrice: number; minPct: number; limit: number },
): Mover[] {
  const movers: Mover[] = [];
  for (const r of rows) {
    const t = r.ticker;
    const v = r.values ?? {};
    const price = parseFloatOr(v.price, parseFloatOr(t.pprice, parseFloatOr(t.close, 0)));
    const changePct = parseFloatOr(v.changeRatio) * 100;
    const changeAbs = parseFloatOr(v.change);
    const prevClose = parseFloatOr(t.preClose, parseFloatOr(t.close));
    const volume = parseFloatOr(t.volume);
    if (price < opts.minPrice) continue;
    if (side === "gainers" ? changePct < opts.minPct : changePct > -opts.minPct) continue;
    movers.push({
      tickerId: t.tickerId,
      symbol: t.symbol,
      name: t.name,
      exchange: t.disExchangeCode ?? t.exchangeCode ?? "",
      price,
      changePct,
      changeAbs,
      prevClose,
      volume,
    });
  }
  movers.sort((a, b) => (side === "gainers" ? b.changePct - a.changePct : a.changePct - b.changePct));
  return movers.slice(0, opts.limit);
}

// Fetch live extended-hours quotes for the given tickers. The ranking endpoint's
// `values` block is a stale snapshot during pre/post market, so we re-quote here.
export async function fetchExtendedQuotes(tickerIds: number[]): Promise<Map<number, LiveQuote>> {
  const out = new Map<number, LiveQuote>();
  const CHUNK = 50;
  const chunks: number[][] = [];
  for (let i = 0; i < tickerIds.length; i += CHUNK) {
    chunks.push(tickerIds.slice(i, i + CHUNK));
  }
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const url = `https://quotes-gw.webullfintech.com/api/bgw/quote/realtime?ids=${chunk.join(",")}&includeSecu=1&delay=0&more=1`;
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) return [] as WebullRealtimeQuote[];
        return (await res.json()) as WebullRealtimeQuote[];
      } catch {
        return [] as WebullRealtimeQuote[];
      }
    }),
  );
  for (const rows of results) {
    for (const q of rows ?? []) {
      const close = parseFloatOr(q.close);
      out.set(q.tickerId, {
        price: parseFloatOr(q.pPrice, close),
        changePct: parseFloatOr(q.pChRatio) * 100,
        changeAbs: parseFloatOr(q.pChange),
        prevClose: close,
      });
    }
  }
  return out;
}

// Build movers from ranking rows using live extended-hours quotes instead of the
// stale ranking `values`. Direction (gainer/loser) is decided by the live move,
// so a name that the stale ranking misclassifies lands on the correct side.
export function rowsToExtendedMovers(
  rows: WebullRow[],
  quotes: Map<number, LiveQuote>,
  side: Side,
  opts: { minPrice: number; minPct: number; limit: number },
): Mover[] {
  const movers: Mover[] = [];
  const seen = new Set<number>();
  for (const r of rows) {
    const t = r.ticker;
    if (seen.has(t.tickerId)) continue;
    const q = quotes.get(t.tickerId);
    if (!q) continue;
    seen.add(t.tickerId);
    if (q.price < opts.minPrice) continue;
    if (side === "gainers" ? q.changePct < opts.minPct : q.changePct > -opts.minPct) continue;
    movers.push({
      tickerId: t.tickerId,
      symbol: t.symbol,
      name: t.name,
      exchange: t.disExchangeCode ?? t.exchangeCode ?? "",
      price: q.price,
      changePct: q.changePct,
      changeAbs: q.changeAbs,
      prevClose: q.prevClose,
      volume: parseFloatOr(t.volume),
    });
  }
  movers.sort((a, b) => (side === "gainers" ? b.changePct - a.changePct : a.changePct - b.changePct));
  return movers.slice(0, opts.limit);
}

type BriefEntry = { description?: string; industry?: string; fetchedAt: number };
const briefCache = new Map<number, BriefEntry>();
const BRIEF_TTL_MS = 24 * 60 * 60 * 1000;

function trimDescription(text: string | undefined, maxLen = 220): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  if (cleaned.length <= maxLen) return cleaned;
  const slice = cleaned.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 60 ? lastSpace : maxLen).trimEnd()}…`;
}

async function fetchCompanyBrief(tickerId: number): Promise<BriefEntry> {
  const cached = briefCache.get(tickerId);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < BRIEF_TTL_MS) return cached;
  try {
    const url = `https://quotes-gw.webullfintech.com/api/information/stock/brief?tickerId=${tickerId}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Webull brief HTTP ${res.status}`);
    const json = (await res.json()) as WebullBriefResponse;
    const entry: BriefEntry = {
      description: trimDescription(json.companyBrief?.introduce),
      industry: json.companyBrief?.industry?.trim() || undefined,
      fetchedAt: now,
    };
    briefCache.set(tickerId, entry);
    return entry;
  } catch {
    const entry: BriefEntry = { fetchedAt: now };
    briefCache.set(tickerId, entry);
    return entry;
  }
}

export async function enrichWithBriefs(movers: Mover[]): Promise<Mover[]> {
  const briefs = await Promise.all(movers.map((m) => fetchCompanyBrief(m.tickerId)));
  return movers.map((m, i) => ({
    ...m,
    description: briefs[i].description,
    industry: briefs[i].industry,
  }));
}
