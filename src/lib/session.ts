export type Session = "pre" | "regular" | "after" | "closed-weekend" | "closed-overnight";

export type RankType = "preMarket" | "1d" | "afterMarket";

export type SessionInfo = {
  session: Session;
  rankType: RankType;
  label: string;
  sublabel: string;
};

function nowInET(): { day: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { day: days[weekday] ?? 1, hour, minute };
}

export function currentSession(): SessionInfo {
  const { day, hour, minute } = nowInET();
  const minutes = hour * 60 + minute;
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) {
    return {
      session: "closed-weekend",
      rankType: "1d",
      label: "Market Closed",
      sublabel: "Showing last session's gainers",
    };
  }

  // 4:00 AM - 9:30 AM ET
  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) {
    return {
      session: "pre",
      rankType: "preMarket",
      label: "Pre-Market Movers",
      sublabel: "Live before the open",
    };
  }
  // 9:30 AM - 4:00 PM ET
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) {
    return {
      session: "regular",
      rankType: "1d",
      label: "Today's Movers",
      sublabel: "Live during market hours",
    };
  }
  // 4:00 PM - 8:00 PM ET
  if (minutes >= 16 * 60 && minutes < 20 * 60) {
    return {
      session: "after",
      rankType: "afterMarket",
      label: "After-Hours Movers",
      sublabel: "Live after the close",
    };
  }
  // Overnight: show last after-hours data
  return {
    session: "closed-overnight",
    rankType: "afterMarket",
    label: "Market Closed",
    sublabel: "Showing last after-hours gainers",
  };
}
