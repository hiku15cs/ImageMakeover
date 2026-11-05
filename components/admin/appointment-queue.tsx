"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Clock3, MessageCircle, Plus, Search, Users, X } from "lucide-react";
import {
  createWalkIn,
  getAdminAppointments,
  type AppointmentStatus,
  type BookingService,
  type QueueAppointment,
  updateAppointmentStatus,
} from "@/app/actions/appointments";
import type { signOut as SignOutAction } from "@/app/actions/auth";

type Props = { initialAppointments: QueueAppointment[]; services: BookingService[]; signOut: typeof SignOutAction };
type QueueTab = "today" | "upcoming" | "past";
type CalendarView = "day" | "week";

const statusClass: Record<AppointmentStatus, string> = {
  pending: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  confirmed: "border-brand-gold/50 bg-brand-gold/10 text-brand-champagne",
  in_chair: "border-violet-400/40 bg-violet-400/10 text-violet-200",
  completed: "border-emerald-400/30 bg-emerald-400/5 text-emerald-200",
  cancelled: "border-red-400/30 bg-red-400/5 text-red-200",
};

const nextStatuses: Record<AppointmentStatus, Array<{ value: AppointmentStatus; label: string }>> = {
  pending: [{ value: "confirmed", label: "Confirm" }, { value: "cancelled", label: "Cancel" }],
  confirmed: [{ value: "in_chair", label: "In chair" }, { value: "cancelled", label: "Cancel" }],
  in_chair: [{ value: "completed", label: "Complete" }, { value: "cancelled", label: "Cancel" }],
  completed: [],
  cancelled: [],
};

function localDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function customerName(appointment: QueueAppointment) {
  return appointment.guest_name || appointment.profiles?.full_name || "Customer";
}

function customerPhone(appointment: QueueAppointment) {
  return appointment.guest_phone || appointment.profiles?.phone || "";
}

function getWalkInAvailability(durationMinutes: number, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const currentMinutes = Number(value("hour")) * 60 + Number(value("minute"));
  const closingMinutes = 20 * 60 + 30;

  if (value("weekday") === "Tuesday" || currentMinutes < 10 * 60 || currentMinutes >= closingMinutes) {
    return "Walk-ins are available Wednesday–Monday, 10:00 AM–8:30 PM IST.";
  }
  if (currentMinutes + durationMinutes > closingMinutes) {
    return "This service cannot be completed before the salon closes at 8:30 PM IST.";
  }
  return "";
}

function whatsappLink(appointment: QueueAppointment) {
  const phone = customerPhone(appointment).replace(/\D/g, "");
  if (!phone) return null;
  const message = `Hi ${customerName(appointment)}, your appointment for ${appointment.services?.title ?? "your service"} at Image Makeover is confirmed for ${formatDate(appointment.scheduled_at)} at ${formatTime(appointment.scheduled_at)}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export default function AppointmentQueue({ initialAppointments, services, signOut }: Props) {
  const today = localDate(new Date());
  const [appointments, setAppointments] = useState(initialAppointments);
  const [tab, setTab] = useState<QueueTab>("today");
  const [view, setView] = useState<CalendarView>("day");
  const [focusDate, setFocusDate] = useState(today);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AppointmentStatus>("all");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const shownAppointments = useMemo(() => {
    const focus = new Date(`${focusDate}T12:00:00Z`);
    const weekEnd = new Date(focus);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    return appointments.filter((appointment) => {
      const appointmentDate = localDate(new Date(appointment.scheduled_at));
      const inCalendarRange = view === "day"
        ? appointmentDate === focusDate
        : appointmentDate >= focusDate && new Date(`${appointmentDate}T12:00:00Z`) < weekEnd;
      const inTab = tab === "today"
        ? inCalendarRange
        : tab === "upcoming"
          ? appointmentDate > today && appointment.status !== "cancelled" && appointment.status !== "completed"
          : appointmentDate < today || appointment.status === "completed" || appointment.status === "cancelled";
      const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;
      const search = query.trim().toLowerCase();
      const matchesSearch = !search || [
        customerName(appointment),
        customerPhone(appointment),
        appointment.services?.title ?? "",
      ].some((value) => value.toLowerCase().includes(search));
      return inTab && matchesStatus && matchesSearch;
    }).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }, [appointments, focusDate, query, statusFilter, tab, today, view]);

  async function refreshAppointments() {
    const from = new Date(`${focusDate}T00:00:00+05:30`);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 31);
    const result = await getAdminAppointments(
      new Date(from.getTime() - 90 * 86_400_000).toISOString(),
      to.toISOString(),
    );
    setAppointments(result);
  }

  async function changeStatus(id: string, status: AppointmentStatus) {
    setError("");
    setNotice("");
    setBusyId(id);
    try {
      await updateAppointmentStatus(id, status);
      await refreshAppointments();
      setNotice(`Appointment status changed to ${status.replace("_", " ")}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update appointment.");
    } finally {
      setBusyId("");
    }
  }

  async function addWalkIn(input: { name: string; phone: string; serviceId: string }) {
    setError("");
    setNotice("");
    const result = await createWalkIn(input);
    if ("error" in result) throw new Error(result.error);
    await refreshAppointments();
    setWalkInOpen(false);
    setNotice(`Walk-in added to the queue (${result.id.slice(0, 8).toUpperCase()}).`);
  }

  return (
    <main className="min-h-screen bg-brand-background">
      <header className="border-b border-brand-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-brand-muted transition hover:text-white"><ArrowLeft size={17} /> Image Makeover</Link>
          <div className="flex items-center gap-4">
            <span className="font-display text-lg">Salon <span className="gold-text italic">operations</span></span>
            <form action={signOut}><button className="rounded-full border border-brand-border px-3 py-2 text-xs text-brand-muted transition hover:border-brand-gold hover:text-white">Sign out</button></form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-9 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[.25em] text-brand-antique">Appointments · IST</p>
            <h1 className="font-display text-4xl sm:text-5xl">The <span className="gold-text italic">queue.</span></h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/clients" className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-border px-5 py-3 text-sm text-brand-muted transition hover:border-brand-gold hover:text-brand-champagne"><Users size={16} /> Client CRM</Link>
            <button type="button" onClick={() => setWalkInOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gold px-5 py-3 text-sm font-semibold text-brand-background transition hover:bg-brand-champagne"><Plus size={17} /> Add walk-in</button>
          </div>
        </div>

        {error && <p role="alert" className="mt-5 rounded-lg border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">{notice}</p>}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2 overflow-x-auto">
            {([
              ["today", "Today’s queue"],
              ["upcoming", "Upcoming"],
              ["past", "Past / completed"],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setTab(value)} className={`whitespace-nowrap rounded-full border px-4 py-2.5 text-sm ${tab === value ? "border-brand-gold bg-brand-gold text-brand-background" : "border-brand-border text-brand-muted hover:text-white"}`}>{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-brand-border p-1">
              {(["day", "week"] as const).map((value) => <button key={value} type="button" onClick={() => setView(value)} className={`rounded-full px-3 py-1.5 text-xs capitalize ${view === value ? "bg-brand-surface text-brand-foreground" : "text-brand-muted"}`}>{value}</button>)}
            </div>
            <label className="sr-only" htmlFor="queue-date">Focus date</label>
            <input id="queue-date" type="date" value={focusDate} onChange={(event) => setFocusDate(event.target.value)} className="rounded-full border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-foreground" />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
            <input aria-label="Search appointments" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone or service" className="w-full rounded-lg border border-brand-border bg-brand-surface py-3 pl-9 pr-3 text-sm outline-none placeholder:text-brand-muted/70 focus:border-brand-gold" />
          </label>
          <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | AppointmentStatus)} className="rounded-lg border border-brand-border bg-brand-surface px-3 py-3 text-sm outline-none focus:border-brand-gold">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="in_chair">In-chair</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
          </select>
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
          <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
            <h2 className="font-display text-xl">{tab === "today" ? "Appointments" : tab === "upcoming" ? "Upcoming appointments" : "Past appointments"}</h2>
            <span className="text-xs text-brand-muted">{shownAppointments.length} result{shownAppointments.length === 1 ? "" : "s"}</span>
          </div>
          {shownAppointments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-brand-background/60 text-xs uppercase tracking-wider text-brand-muted">
                  <tr><th className="px-5 py-3 font-medium">Time</th><th className="px-5 py-3 font-medium">Customer</th><th className="px-5 py-3 font-medium">Service</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {shownAppointments.map((appointment) => {
                    const messageLink = whatsappLink(appointment);
                    return (
                      <tr key={appointment.id} className="align-top">
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 font-medium"><Clock3 size={14} className="text-brand-gold" />{formatTime(appointment.scheduled_at)}</span>
                          {view === "week" && <span className="mt-1 block pl-5 text-xs text-brand-muted">{formatDate(appointment.scheduled_at)}</span>}
                          <span className="mt-1 block pl-5 text-xs text-brand-muted">{appointment.duration_minutes} min</span>
                        </td>
                        <td className="px-5 py-4"><p className="font-medium">{customerName(appointment)}</p><p className="mt-1 text-xs text-brand-muted">{customerPhone(appointment) || "No phone provided"}</p></td>
                        <td className="px-5 py-4"><p>{appointment.services?.title ?? "Service unavailable"}</p><p className="mt-1 text-xs text-brand-muted">₹{Number(appointment.services?.price ?? 0).toLocaleString("en-IN")}</p></td>
                        <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs capitalize ${statusClass[appointment.status]}`}>{appointment.status.replace("_", " ")}</span></td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            {nextStatuses[appointment.status].map((next) => (
                              <button key={next.value} type="button" disabled={busyId === appointment.id} onClick={() => void changeStatus(appointment.id, next.value)} className={`rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-50 ${next.value === "cancelled" ? "border-red-400/30 text-red-200 hover:bg-red-400/10" : "border-brand-gold/40 text-brand-champagne hover:bg-brand-gold/10"}`}>{next.label}</button>
                            ))}
                            {messageLink && appointment.status !== "cancelled" && <a href={messageLink} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${customerName(appointment)}`} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-400/10"><MessageCircle size={13} /> WhatsApp</a>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center px-6 text-center">
              <div><CalendarDays className="mx-auto text-brand-antique" size={24} /><p className="mt-3 text-sm">No appointments match this view.</p><p className="mt-1 text-xs text-brand-muted">Try another date or add a walk-in.</p></div>
            </div>
          )}
        </section>
      </div>

      {walkInOpen && <WalkInModal services={services} onClose={() => setWalkInOpen(false)} onCreate={addWalkIn} />}
    </main>
  );
}

function WalkInModal({
  services,
  onClose,
  onCreate,
}: {
  services: BookingService[];
  onClose: () => void;
  onCreate: (input: { name: string; phone: string; serviceId: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedService = services.find((service) => service.id === serviceId);
  const availabilityMessage = selectedService
    ? getWalkInAvailability(selectedService.duration_minutes)
    : "Add an active service before creating a walk-in.";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onCreate({ name, phone, serviceId });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not add walk-in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="walkin-title" className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-wider text-brand-antique">Front desk</p><h2 id="walkin-title" className="mt-2 font-display text-2xl">Add a walk-in</h2></div><button type="button" aria-label="Close dialog" onClick={onClose} className="rounded-full border border-brand-border p-2 text-brand-muted hover:text-white"><X size={17} /></button></div>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200">{error}</p>}
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div><label htmlFor="walkin-name" className="mb-2 block text-sm">Customer name</label><input id="walkin-name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-brand-border bg-brand-background px-3 py-3 text-sm outline-none focus:border-brand-gold" /></div>
          <div><label htmlFor="walkin-phone" className="mb-2 block text-sm">Phone number</label><input id="walkin-phone" type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-lg border border-brand-border bg-brand-background px-3 py-3 text-sm outline-none focus:border-brand-gold" /></div>
          <div><label htmlFor="walkin-service" className="mb-2 block text-sm">Service</label><select id="walkin-service" required value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="w-full rounded-lg border border-brand-border bg-brand-background px-3 py-3 text-sm outline-none focus:border-brand-gold">{services.map((service) => <option key={service.id} value={service.id}>{service.title} · {service.duration_minutes} min</option>)}</select></div>
          {availabilityMessage ? <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">{availabilityMessage}</p> : <p className="text-xs text-brand-muted">The appointment is added straight to the In-chair queue. Available capacity is checked by the database.</p>}
          <button type="submit" disabled={busy || !services.length || Boolean(availabilityMessage)} className="w-full rounded-full bg-brand-gold px-4 py-3 text-sm font-semibold text-brand-background disabled:opacity-50">{busy ? "Adding walk-in…" : <><Check className="mr-2 inline" size={16} /> Add to queue</>}</button>
        </form>
      </section>
    </div>
  );
}
