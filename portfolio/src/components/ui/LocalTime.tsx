"use client";

import { useEffect, useState } from "react";
import { site } from "@/content/site";

const format = () =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: site.timezone,
    timeZoneName: "short",
  }).format(new Date());

/** Pieter's local time, so a visitor can tell whether it is working hours there. */
export function LocalTime() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(format());
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);

  return (
    <time className="tabular-nums" suppressHydrationWarning>
      {time ?? "--:--"}
    </time>
  );
}
