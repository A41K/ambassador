"use client";

import { useMemo, useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

export function LocalDateTime({
  value,
  locale,
}: {
  value: string | number | Date | null | undefined;
  locale: string;
}) {
  const isoValue = useMemo(() => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }, [value]);
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const label = isoValue !== null && hasHydrated
    ? formatLocalDateTime(isoValue, locale)
    : null;

  if (isoValue === null) {
    return <span>-</span>;
  }

  return (
    <time dateTime={isoValue} suppressHydrationWarning>
      {label ?? "Loading..."}
    </time>
  );
}

function formatLocalDateTime(isoValue: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(isoValue));
}
