"use client";

import { useEffect, useState } from "react";
import { getOpenStatus, type OpenStatus } from "./public-content";

export default function OpenStatusBadge() {
  const [status, setStatus] = useState<OpenStatus | null>(null);

  useEffect(() => {
    const update = () => setStatus(getOpenStatus(new Date()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-brand-border bg-brand-surface/80 px-3 py-2.5 sm:gap-3 sm:px-4">
      <span className={`h-2.5 w-2.5 rounded-full ${status?.open ? "bg-emerald-400 shadow-[0_0_12px_#34d399]" : "bg-brand-muted"}`} />
      <span className="text-xs font-medium sm:text-sm">{status?.message ?? "Checking hours…"}</span>
      {status && <span className="border-l border-brand-border pl-2 text-[10px] text-brand-muted sm:pl-3 sm:text-xs">{status.next}</span>}
    </div>
  );
}
