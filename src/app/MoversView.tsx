"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MoversPayload } from "./api/movers/route";
import type { Mover } from "@/lib/webull";

const REFRESH_MS = 300_000;

type SortDir = "desc" | "asc";

function formatPrice(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function formatVolume(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function MoversView({ initial }: { initial: MoversPayload }) {
  const [data, setData] = useState<MoversPayload>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [errorVisible, setErrorVisible] = useState<string | null>(initial.error ?? null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const res = await fetch("/api/movers", { cache: "no-store" });
      const json = (await res.json()) as MoversPayload;
      setData(json);
      setErrorVisible(json.error ?? null);
    } catch (err) {
      setErrorVisible(err instanceof Error ? err.message : "Network error");
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const { session, gainers, losers, dataAsOf, fetchedAt } = data;

  const sortedGainers = useMemo(
    () => [...gainers].sort((a, b) => (sortDir === "desc" ? b.changePct - a.changePct : a.changePct - b.changePct)),
    [gainers, sortDir],
  );
  const sortedLosers = useMemo(
    () => [...losers].sort((a, b) => (sortDir === "desc" ? a.changePct - b.changePct : b.changePct - a.changePct)),
    [losers, sortDir],
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6 sm:mb-8">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{session.label}</h1>
          <div className="flex items-center gap-2">
            <SortToggle dir={sortDir} onChange={setSortDir} />
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="rounded-full border border-[var(--card-border)] bg-[var(--card)] px-4 py-2 text-base font-medium text-[var(--muted)] transition active:scale-95 disabled:opacity-60"
              aria-label="Refresh"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)] sm:text-base">{session.sublabel}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Movers above 4% • $35+ stocks • updated {formatDate(dataAsOf ?? fetchedAt)} {formatClock(dataAsOf ?? fetchedAt)}
        </p>
        {errorVisible && (
          <p className="mt-3 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            Couldn&apos;t reach data source: {errorVisible}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MoversColumn title="Gainers" tone="gain" movers={sortedGainers} sortDir={sortDir} />
        <MoversColumn title="Losers" tone="loss" movers={sortedLosers} sortDir={sortDir} />
      </div>

      <footer className="mt-10 text-center text-xs text-[var(--muted)]">
        Auto-refresh every 5m • Data from Webull
      </footer>
    </main>
  );
}

function SortToggle({ dir, onChange }: { dir: SortDir; onChange: (d: SortDir) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(dir === "desc" ? "asc" : "desc")}
      className="rounded-full border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition active:scale-95"
      aria-label={`Sort ${dir === "desc" ? "descending" : "ascending"}`}
      title="Toggle sort order"
    >
      Sort: {dir === "desc" ? "High → Low" : "Low → High"}
    </button>
  );
}

function MoversColumn({
  title,
  tone,
  movers,
  sortDir,
}: {
  title: string;
  tone: "gain" | "loss";
  movers: Mover[];
  sortDir: SortDir;
}) {
  const accent = tone === "gain" ? "text-[var(--gain)]" : "text-[var(--loss)]";
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className={`text-lg font-semibold tracking-tight ${accent}`}>{title}</h2>
        <span className="text-xs text-[var(--muted)]">{movers.length} • {sortDir === "desc" ? "↓" : "↑"}</span>
      </div>
      {movers.length === 0 ? (
        <EmptyState tone={tone} />
      ) : (
        <ol className="space-y-3">
          {movers.map((m, i) => (
            <li key={m.symbol}>
              <MoverCard mover={m} index={i} tone={tone} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MoverCard({ mover, index, tone }: { mover: Mover; index: number; tone: "gain" | "loss" }) {
  const pctText = `${tone === "loss" ? "" : ""}${formatPct(mover.changePct)}`;
  const pctClass = tone === "gain" ? "text-[var(--gain)] bg-[var(--gain-bg)]" : "text-[var(--loss)] bg-[var(--loss-bg)]";
  return (
    <article className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-4 shadow-[0_1px_2px_rgba(15,23,41,0.04)] sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-[var(--muted)] tabular-nums">
            {(index + 1).toString().padStart(2, "0")}
          </span>
          <span className="truncate text-xl font-bold tracking-tight">{mover.symbol}</span>
          <span className="hidden text-xs font-medium text-[var(--muted)] sm:inline">{mover.exchange}</span>
        </div>
        <div className="truncate text-sm text-[var(--muted)]">{mover.name}</div>
        {(mover.description || mover.industry) && (
          <p className="mt-1 line-clamp-3 text-xs leading-snug text-[var(--muted)]">
            {mover.industry && <span className="font-medium">{mover.industry}. </span>}
            {mover.description ?? ""}
          </p>
        )}
        <div className="mt-2 flex items-baseline gap-3 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--foreground)] tabular-nums">{formatPrice(mover.price)}</span>
          <span className="tabular-nums">Vol {formatVolume(mover.volume)}</span>
        </div>
      </div>
      <div className={`shrink-0 rounded-xl px-3 py-2 text-right ${pctClass}`}>
        <div className="text-lg font-bold tabular-nums sm:text-xl">{pctText}</div>
      </div>
    </article>
  );
}

function EmptyState({ tone }: { tone: "gain" | "loss" }) {
  const word = tone === "gain" ? "gainers" : "losers";
  return (
    <div className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--card)] px-6 py-10 text-center">
      <p className="text-sm font-medium">No {word} above 4% right now.</p>
    </div>
  );
}
