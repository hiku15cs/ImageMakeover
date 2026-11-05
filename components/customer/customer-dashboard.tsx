"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Camera, Check, Clock3, Download, Gift, LogOut, Sparkles } from "lucide-react";
import { cancelCustomerAppointment, rescheduleCustomerAppointment } from "@/app/actions/customer";
import { signOut } from "@/app/actions/auth";

type CustomerAppointment = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  amount_paid: number;
  services: { title: string; price: number } | null;
};

type CustomerPackage = {
  id: string;
  total_sessions: number;
  used_sessions: number;
  purchased_at: string;
  expires_at: string | null;
  services: { title: string } | null;
};

type LookbookPhoto = {
  id: string;
  title: string;
  category: string;
  image_url: string;
  created_at: string;
};

export type CustomerDashboardData = {
  profile: { full_name: string | null; total_spend: number; loyalty_visits: number };
  appointments: CustomerAppointment[];
  packages: CustomerPackage[];
  lookbook: LookbookPhoto[];
};

type Tab = "lookbook" | "appointments" | "loyalty";

const statusClass: Record<string, string> = {
  pending: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  confirmed: "border-brand-gold/50 bg-brand-gold/10 text-brand-champagne",
  in_chair: "border-violet-400/40 bg-violet-400/10 text-violet-200",
  completed: "border-emerald-400/30 bg-emerald-400/5 text-emerald-200",
  cancelled: "border-red-400/30 bg-red-400/5 text-red-200",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function todayInIndia() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function money(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export default function CustomerDashboard({ data }: { data: CustomerDashboardData }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("lookbook");
  const [rescheduleId, setRescheduleId] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const now = Date.now();
  const upcoming = data.appointments.filter((appointment) =>
    new Date(appointment.scheduled_at).getTime() >= now
      && ["pending", "confirmed", "in_chair"].includes(appointment.status),
  );
  const history = data.appointments.filter((appointment) => !upcoming.includes(appointment));
  const visitsUntilReward = data.profile.loyalty_visits % 5;
  const rewardReady = data.profile.loyalty_visits > 0 && visitsUntilReward === 0;

  async function cancel(appointment: CustomerAppointment) {
    if (!window.confirm("Cancel this appointment?")) return;
    setError("");
    setNotice("");
    setBusyId(appointment.id);
    try {
      await cancelCustomerAppointment(appointment.id);
      setNotice("Your appointment has been cancelled.");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not cancel this appointment.");
    } finally {
      setBusyId("");
    }
  }

  async function reschedule(appointmentId: string) {
    setError("");
    setNotice("");
    if (!rescheduleDate || !rescheduleTime) {
      setError("Choose a new date and time.");
      return;
    }
    setBusyId(appointmentId);
    try {
      const scheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}:00+05:30`).toISOString();
      await rescheduleCustomerAppointment(appointmentId, scheduledAt);
      setRescheduleId("");
      setNotice("Your appointment has been rescheduled.");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not reschedule this appointment.");
    } finally {
      setBusyId("");
    }
  }

  async function downloadPhoto(photo: LookbookPhoto) {
    setError("");
    try {
      const response = await fetch(photo.image_url);
      if (!response.ok) throw new Error("Could not download this lookbook photo.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${photo.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "image-makeover"}.jpg`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not download this photo.");
    }
  }

  return (
    <main className="min-h-screen bg-brand-background">
      <header className="border-b border-brand-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" className="font-display text-lg">Image <span className="gold-text">Makeover</span></Link>
          <form action={signOut}><button className="inline-flex items-center gap-2 rounded-full border border-brand-border px-3 py-2 text-xs text-brand-muted transition hover:border-brand-gold hover:text-white"><LogOut size={14} /> Sign out</button></form>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-9 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[.25em] text-brand-antique">Your personal space</p>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">Welcome{data.profile.full_name ? `, ${data.profile.full_name.split(" ")[0]}` : ""}<span className="gold-text italic">.</span></h1>
        <div className="mt-7 flex flex-wrap gap-3 text-sm">
          <div className="rounded-xl border border-brand-border bg-brand-surface px-4 py-3"><span className="text-brand-muted">Completed visits</span><strong className="ml-3 text-brand-champagne">{data.profile.loyalty_visits}</strong></div>
          <div className="rounded-xl border border-brand-border bg-brand-surface px-4 py-3"><span className="text-brand-muted">Lifetime spend</span><strong className="ml-3 text-brand-champagne">{money(data.profile.total_spend)}</strong></div>
          <div className="rounded-xl border border-brand-border bg-brand-surface px-4 py-3"><span className="text-brand-muted">Upcoming</span><strong className="ml-3 text-brand-champagne">{upcoming.length}</strong></div>
        </div>

        {error && <p role="alert" className="mt-6 rounded-lg border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-6 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">{notice}</p>}

        <nav aria-label="Customer dashboard sections" className="mt-8 flex gap-2 overflow-x-auto border-b border-brand-border">
          {([
            ["lookbook", "My Lookbook"],
            ["appointments", "Appointments"],
            ["loyalty", "Loyalty & Passes"],
          ] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm transition ${tab === key ? "border-brand-gold text-brand-champagne" : "border-transparent text-brand-muted hover:text-white"}`}>{label}</button>
          ))}
        </nav>

        {tab === "lookbook" && (
          <section className="py-7">
            <div className="mb-5 flex items-center gap-2"><Camera size={18} className="text-brand-gold" /><h2 className="font-display text-2xl">Your personal lookbook</h2></div>
            {data.lookbook.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.lookbook.map((photo) => (
                  <article key={photo.id} className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.image_url} alt={photo.title} className="aspect-[4/3] w-full object-cover" />
                    <div className="flex items-center justify-between gap-3 p-4">
                      <div><h3 className="font-medium">{photo.title}</h3><p className="mt-1 text-xs text-brand-muted">{photo.category} · {formatDate(photo.created_at)}</p></div>
                      <button type="button" onClick={() => void downloadPhoto(photo)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-border px-3 py-2 text-xs text-brand-gold hover:border-brand-gold"><Download size={14} /> HD</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <EmptyState icon={<Camera size={20} />} text="Your saved makeover photos will appear here after your stylist adds them to your lookbook." />}
          </section>
        )}

        {tab === "appointments" && (
          <section className="grid gap-8 py-7 lg:grid-cols-2">
            <div>
              <h2 className="mb-4 flex items-center gap-2 font-display text-2xl"><CalendarClock size={19} className="text-brand-gold" /> Upcoming appointments</h2>
              {upcoming.length ? <div className="space-y-3">{upcoming.map((appointment) => {
                const canManage = ["pending", "confirmed"].includes(appointment.status)
                  && new Date(appointment.scheduled_at).getTime() > Date.now() + 4 * 60 * 60 * 1000;
                return (
                  <article key={appointment.id} className="rounded-2xl border border-brand-border bg-brand-surface p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h3 className="font-medium">{appointment.services?.title ?? "Salon appointment"}</h3><p className="mt-1 flex items-center gap-1.5 text-sm text-brand-muted"><Clock3 size={14} /> {formatDate(appointment.scheduled_at)} · {formatTime(appointment.scheduled_at)}</p></div>
                      <StatusBadge status={appointment.status} />
                    </div>
                    {canManage && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" disabled={busyId === appointment.id} onClick={() => { setError(""); setRescheduleId(rescheduleId === appointment.id ? "" : appointment.id); }} className="rounded-full border border-brand-border px-3 py-2 text-xs text-brand-muted hover:border-brand-gold hover:text-white">Reschedule</button>
                        <button type="button" disabled={busyId === appointment.id} onClick={() => void cancel(appointment)} className="rounded-full border border-red-400/30 px-3 py-2 text-xs text-red-200 hover:bg-red-400/10">{busyId === appointment.id ? "Updating…" : "Cancel"}</button>
                      </div>
                    )}
                    {rescheduleId === appointment.id && (
                      <div className="mt-4 grid gap-3 rounded-xl border border-brand-border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <label className="text-xs text-brand-muted">New date<input type="date" min={todayInIndia()} value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} className="mt-2 block w-full rounded-lg border border-brand-border bg-brand-background px-3 py-2 text-sm text-white" /></label>
                        <label className="text-xs text-brand-muted">New time (IST)<input type="time" step={1800} value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} className="mt-2 block w-full rounded-lg border border-brand-border bg-brand-background px-3 py-2 text-sm text-white" /></label>
                        <button type="button" disabled={busyId === appointment.id} onClick={() => void reschedule(appointment.id)} className="rounded-full bg-brand-gold px-4 py-2.5 text-xs font-semibold text-brand-background disabled:opacity-50">{busyId === appointment.id ? "Saving…" : "Confirm time"}</button>
                      </div>
                    )}
                  </article>
                );
              })}</div> : <EmptyState icon={<CalendarClock size={20} />} text="You don't have any upcoming appointments." />}
            </div>
            <div>
              <h2 className="mb-4 font-display text-2xl">Service history</h2>
              {history.length ? <div className="space-y-3">{history.map((appointment) => (
                <article key={appointment.id} className="flex items-center justify-between gap-4 rounded-2xl border border-brand-border bg-brand-surface p-5">
                  <div><h3 className="font-medium">{appointment.services?.title ?? "Salon appointment"}</h3><p className="mt-1 text-sm text-brand-muted">{formatDate(appointment.scheduled_at)} · {formatTime(appointment.scheduled_at)}</p></div>
                  <div className="text-right"><StatusBadge status={appointment.status} /><p className="mt-2 text-sm text-brand-champagne">{appointment.status === "completed" ? money(appointment.amount_paid) : "—"}</p></div>
                </article>
              ))}</div> : <EmptyState icon={<Clock3 size={20} />} text="Completed services and receipts will appear here." />}
            </div>
          </section>
        )}

        {tab === "loyalty" && (
          <section className="grid gap-5 py-7 lg:grid-cols-[.8fr_1.2fr]">
            <article className="rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-brand-surface to-[#252116] p-6">
              <div className="flex items-center gap-2 text-brand-champagne"><Gift size={19} /><h2 className="font-display text-2xl">A little thank you</h2></div>
              <p className="mt-2 text-sm text-brand-muted">Every fifth completed visit earns a loyalty reward. Ask our team to redeem it at your next appointment.</p>
              <div className="mt-6 flex items-center gap-3">
                {Array.from({ length: 5 }, (_, index) => {
                  const stamped = rewardReady || index < visitsUntilReward;
                  return <span key={index} aria-label={`Visit ${index + 1}${stamped ? ", stamped" : ""}`} className={`grid h-11 w-11 place-items-center rounded-full border ${stamped ? "border-brand-gold bg-brand-gold text-brand-background shadow-gold" : "border-brand-border text-brand-muted"}`}>{stamped ? <Check size={17} /> : index + 1}</span>;
                })}
              </div>
              <p className="mt-4 text-sm font-medium text-brand-champagne">{rewardReady ? "Your reward is ready!" : `${5 - visitsUntilReward} more visit${5 - visitsUntilReward === 1 ? "" : "s"} until your next reward`}</p>
            </article>
            <div>
              <h2 className="mb-4 flex items-center gap-2 font-display text-2xl"><Sparkles size={18} className="text-brand-gold" /> Your treatment passes</h2>
              {data.packages.length ? <div className="grid gap-3 sm:grid-cols-2">{data.packages.map((pass) => {
                const expired = pass.expires_at ? new Date(pass.expires_at).getTime() < now : false;
                const remaining = pass.total_sessions - pass.used_sessions;
                return (
                  <article key={pass.id} className="rounded-2xl border border-brand-border bg-brand-surface p-5">
                    <div className="flex items-start justify-between gap-3"><h3 className="font-medium">{pass.services?.title ?? "Treatment pass"}</h3><span className={`rounded-full border px-2.5 py-1 text-[10px] ${expired || !remaining ? "border-brand-border text-brand-muted" : "border-brand-gold/40 text-brand-champagne"}`}>{expired ? "Expired" : remaining ? "Active" : "Complete"}</span></div>
                    <p className="mt-4 font-display text-2xl text-brand-champagne">{pass.used_sessions} <span className="text-base text-brand-muted">of {pass.total_sessions} used</span></p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-border"><div className="h-full rounded-full bg-brand-gold" style={{ width: `${Math.min(100, pass.used_sessions / pass.total_sessions * 100)}%` }} /></div>
                    <p className="mt-3 text-xs text-brand-muted">{remaining} session{remaining === 1 ? "" : "s"} remaining{pass.expires_at ? ` · Expires ${formatDate(pass.expires_at)}` : ""}</p>
                  </article>
                );
              })}</div> : <EmptyState icon={<Sparkles size={20} />} text="Any prepaid multi-session passes will show up here." />}
            </div>
          </section>
        )}
        <div className="mt-5 border-t border-brand-border pt-5"><Link href="/services" className="text-sm text-brand-gold hover:text-brand-champagne">Explore services</Link></div>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] capitalize ${statusClass[status] ?? "border-brand-border text-brand-muted"}`}>{status.replace("_", " ")}</span>;
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-brand-border px-6 py-8 text-center text-sm text-brand-muted"><div>{icon}<p className="mt-3 max-w-sm">{text}</p></div></div>;
}
