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
    <div className="inline-flex items-center gap-3 rounded-full border border-brand-border bg-brand-surface/80 px-4 py-2.5">
      <span className={`h-2.5 w-2.5 rounded-full ${status?.open ? "bg-emerald-400 shadow-[0_0_12px_#34d399]" : "bg-brand-muted"}`} />
      <span className="text-sm font-medium">{status?.message ?? "Checking hours…"}</span>
      {status && <span className="hidden border-l border-brand-border pl-3 text-xs text-brand-muted sm:inline">{status.next}</span>}
    </div>
  );
}
