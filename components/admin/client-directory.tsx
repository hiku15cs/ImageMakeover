"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Search, Users } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import type { CrmClientSummary, CrmMetrics } from "@/app/actions/crm";

function money(value: number) {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function shortDate(value: string | null) {
  if (!value) return "No completed visits";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function ClientDirectory({
  clients,
  metrics,
}: {
  clients: CrmClientSummary[];
  metrics: CrmMetrics;
}) {
  const [query, setQuery] = useState("");
  const filteredClients = useMemo(() => {
    const search = query.trim().toLowerCase();
    return clients.filter((client) => !search || [
      client.full_name ?? "",
      client.phone ?? "",
      String(client.visit_count),
      String(client.total_spend),
    ].some((value) => value.toLowerCase().includes(search)));
  }, [clients, query]);

  return (
    <main className="min-h-screen bg-brand-background">
      <header className="border-b border-brand-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/admin/appointments" className="inline-flex items-center gap-2 text-sm text-brand-muted transition hover:text-white"><ArrowLeft size={17} /> Operations</Link>
          <div className="flex items-center gap-4"><span className="font-display text-lg">Client <span className="gold-text italic">studio</span></span><form action={signOut}><button className="rounded-full border border-brand-border px-3 py-2 text-xs text-brand-muted hover:border-brand-gold hover:text-white">Sign out</button></form></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-9 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[.25em] text-brand-antique">Private client records</p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">The <span className="gold-text italic">client book.</span></h1>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Client profiles" value={String(clients.length)} />
          <Metric label="Appointments this month" value={String(metrics.monthly_appointments)} />
          <Metric label="Repeat customer retention" value={`${Number(metrics.repeat_customer_retention).toFixed(1)}%`} />
          <Metric label="Top service this month" value={metrics.top_service_title ?? "No completed visits"} detail={metrics.top_service_title ? `${metrics.top_service_appointments} completed` : undefined} />
        </div>
        <section className="mt-8 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
          <div className="flex flex-col justify-between gap-4 border-b border-brand-border p-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2"><Users size={18} className="text-brand-gold" /><h2 className="font-display text-xl">Customer directory</h2><span className="text-xs text-brand-muted">({filteredClients.length})</span></div>
            <label className="relative block w-full sm:max-w-sm"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, visits or spend" className="w-full rounded-lg border border-brand-border bg-brand-background py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-brand-muted/70 focus:border-brand-gold" /></label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-brand-background/60 text-xs uppercase tracking-wider text-brand-muted"><tr><th className="px-5 py-4 font-medium">Client</th><th className="px-5 py-4 font-medium">Phone</th><th className="px-5 py-4 font-medium">Visits</th><th className="px-5 py-4 font-medium">Lifetime spend</th><th className="px-5 py-4 font-medium">Last visit</th><th className="px-5 py-4" /></tr></thead>
              <tbody className="divide-y divide-brand-border">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="transition hover:bg-white/[.025]">
                    <td className="px-5 py-4 font-medium">{client.full_name || "Unnamed client"}</td>
                    <td className="px-5 py-4 text-brand-muted">{client.phone || "—"}</td>
                    <td className="px-5 py-4">{client.visit_count}</td>
                    <td className="px-5 py-4 text-brand-champagne">{money(client.total_spend)}</td>
                    <td className="px-5 py-4 text-brand-muted">{shortDate(client.last_visit)}</td>
                    <td className="px-5 py-4"><Link aria-label={`Open ${client.full_name || "client"} profile`} href={`/admin/clients/${client.id}`} className="inline-flex items-center gap-1 text-xs text-brand-gold hover:text-brand-champagne">Open <ArrowUpRight size={14} /></Link></td>
                  </tr>
                ))}
                {!filteredClients.length && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-brand-muted">No matching client profiles.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <article className="min-w-0 rounded-2xl border border-brand-border bg-brand-surface p-5"><p className="text-xs text-brand-muted">{label}</p><p className="mt-2 truncate font-display text-2xl text-brand-champagne">{value}</p>{detail && <p className="mt-1 text-xs text-brand-muted">{detail}</p>}</article>;
}
