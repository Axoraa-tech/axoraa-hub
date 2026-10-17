"use client";

import { useMemo, useState } from "react";
import { getRange, latestActivity, previousRange, shiftAnchor, type Granularity } from "./analytics";

/** Period state for dashboards. Defaults to the most recent period that has activity. */
export function usePeriod(activityDates: (string | undefined)[], initial: Granularity = "week") {
  const [granularity, setGranularity] = useState<Granularity>(initial);
  const [anchor, setAnchor] = useState<Date | null>(null);

  const latest = useMemo(() => latestActivity(activityDates), [activityDates]);
  const effective = anchor ?? latest;
  const range = useMemo(() => getRange(granularity, effective), [granularity, effective]);
  const prev = useMemo(() => previousRange(range), [range]);

  return {
    granularity,
    setGranularity,
    range,
    prev,
    shift: (dir: -1 | 1) => setAnchor(shiftAnchor(granularity, effective, dir)),
    reset: () => setAnchor(null),
  };
}

/** Collapse long bucket series (e.g. 31 days) into ~weekly groups for compact charts. */
export function compress<T extends { label: string; title: string; value: number }>(data: T[], max = 12) {
  if (data.length <= max) return data;
  const size = Math.ceil(data.length / Math.ceil(data.length / 7));
  const out: { label: string; title: string; value: number }[] = [];
  for (let i = 0; i < data.length; i += size) {
    const chunk = data.slice(i, i + size);
    out.push({
      label: `W${out.length + 1}`,
      title: `${chunk[0].title} – ${chunk[chunk.length - 1].title}`,
      value: chunk.reduce((s, d) => s + d.value, 0),
    });
  }
  return out;
}
