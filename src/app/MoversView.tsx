"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MoversPayload } from "./api/movers/route";

const REFRESH_MS = 30_000;

function formatPrice(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(n: number): string {
  return `+${n.toFixed(2)}%`;
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

export default function MoversView({ initial }: { initial: MoversPayload }) {
  const [data, setData] = useState<MoversPayload>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [errorVisible, setErrorVisible] = useState<string | null>(initial.error ?? null);
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

  const { session, movers, dataAsOf, fetchedAt } = data;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6 sm:mb-8">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {session.label}
          </h1>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="rounded-full border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition active:scale-95 disabled:opacity-60"
            aria-label="Refresh"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)] sm:text-base">{session.sublabel}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Up more than 4% • $5+ stocks • updated {formatClock(dataAsOf ?? fetchedAt)}
        </p>
        {errorVisible && (
          <p className="mt-3 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            Couldn&apos;t reach data source: {errorVisible}
          </p>
        )}
      </header>

      {movers.length === 0 ? (
        <EmptyState />
      ) : (
        <ol className="space-y-3">
          {movers.map((m, i) => (
            <li key={m.symbol}>
              <article className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-4 shadow-[0_1px_2px_rgba(15,23,41,0.04)] sm:px-5 sm:py-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-[var(--muted)] tabular-nums">
                      {(i + 1).toString().padStart(2, "0")}
                    </span>
                    <span className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                      {m.symbol}
                    </span>
                    <span className="hidden text-xs font-medium text-[var(--muted)] sm:inline">
                      {m.exchange}
                    </span>
                  </div>
                  <div className="truncate text-sm text-[var(--muted)] sm:text-base">
                    {m.name}
                  </div>
                  <div className="mt-1 flex items-baseline gap-3 text-sm text-[var(--muted)] sm:text-base">
                    <span className="font-medium text-[var(--foreground)] tabular-nums">
                      {formatPrice(m.price)}
                    </span>
                    <span className="tabular-nums">Vol {formatVolume(m.volume)}</span>
                  </div>
                </div>
                <div className="shrink-0 rounded-xl bg-[var(--gain-bg)] px-3 py-2 text-right sm:px-4 sm:py-3">
                  <div className="text-xl font-bold tabular-nums text-[var(--gain)] sm:text-2xl">
                    {formatPct(m.changePct)}
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}

      <footer className="mt-10 text-center text-xs text-[var(--muted)]">
        Auto-refresh every 30s • Data from Webull
      </footer>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--card)] px-6 py-12 text-center">
      <p className="text-base font-medium">No movers above 4% right now.</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Check back closer to a trading session.
      </p>
    </div>
  );
}
