import type { RankType } from "./session";

export type Mover = {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  changePct: number;
  changeAbs: number;
  prevClose: number;
  volume: number;
};

type WebullTicker = {
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
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function fetchTopGainers(
  rankType: RankType,
  pageSize = 200,
): Promise<{ rows: WebullRow[]; latestUpdateMs: number | null }> {
  const url = `https://quotes-gw.webullfintech.com/api/wlas/ranking/topGainers?regionId=6&rankType=${rankType}&pageSize=${pageSize}&pageIndex=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Webull HTTP ${res.status}`);
  const json = (await res.json()) as WebullResponse & { latestUpdateTime?: number };
  return { rows: json.data ?? [], latestUpdateMs: json.latestUpdateTime ?? null };
}

function parseFloatOr(value: string | undefined, fallback = 0): number {
  if (value == null) return fallback;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export function rowsToMovers(
  rows: WebullRow[],
  rankType: RankType,
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
    if (changePct < opts.minPct) continue;
    movers.push({
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
  movers.sort((a, b) => b.changePct - a.changePct);
  // rankType is reserved for future per-session formatting tweaks
  void rankType;
  return movers.slice(0, opts.limit);
}
