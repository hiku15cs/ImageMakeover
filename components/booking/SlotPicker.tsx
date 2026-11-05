"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createCustomerAppointment, getAvailableSlots, getBookingServices, type AvailableSlot, type BookingService } from "@/app/actions/appointments";

function dateInIndia(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function isTuesday(date: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "long" })
    .format(new Date(`${date}T12:00:00Z`)) === "Tuesday";
}

function formatTime(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export default function SlotPicker() {
  const today = dateInIndia(new Date());
  const [services, setServices] = useState<BookingService[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotAt, setSlotAt] = useState("");
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const selectedService = services.find((service) => service.id === serviceId);
  const selectedSlot = slots.find((slot) => slot.slot_at === slotAt);

  useEffect(() => {
    let active = true;
    void getBookingServices()
      .then((result) => {
        if (!active) return;
        setServices(result);
        setServiceId(result[0]?.id ?? "");
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load services.");
      })
      .finally(() => {
        if (active) setLoadingServices(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedService || !date || isTuesday(date)) {
      setSlots([]);
      setSlotAt("");
      return;
    }
    let active = true;
    setLoadingSlots(true);
    setError("");
    setSlotAt("");
    void getAvailableSlots(date, selectedService.duration_minutes)
      .then((result) => {
        if (active) setSlots(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load available times.");
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => { active = false; };
  }, [date, selectedService]);

  const formattedDate = useMemo(() => date
    ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full" }).format(new Date(`${date}T12:00:00Z`))
    : "", [date]);

  async function submitBooking() {
    if (!selectedService || !selectedSlot?.available) return;
    setError("");
    setConfirmation("");
    setSubmitting(true);
    try {
      const result = await createCustomerAppointment(selectedService.id, selectedSlot.slot_at, guestName, guestPhone);
      setConfirmation(result.id
        ? `Appointment request received. Reference: ${result.id.slice(0, 8).toUpperCase()}. We’ll confirm your booking shortly.`
        : "Appointment request received. We’ll confirm your booking shortly.");
      setSlotAt("");
      try {
        const refreshed = await getAvailableSlots(date, selectedService.duration_minutes);
        setSlots(refreshed);
      } catch (refreshError) {
        setError(`Your appointment was booked, but availability could not refresh: ${refreshError instanceof Error ? refreshError.message : "unknown error"}`);
      }
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : "Could not create your appointment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-8 space-y-5 rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-8">
      {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-200">{error}</p>}
      {confirmation && <p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">{confirmation}</p>}

      <div>
        <label htmlFor="booking-service" className="mb-2 block text-sm font-medium">Choose a service</label>
        {loadingServices ? <p className="text-sm text-brand-muted">Loading services…</p> : (
          <select id="booking-service" value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="w-full rounded-lg border border-brand-border bg-brand-background px-3 py-3 text-sm outline-none focus:border-brand-gold">
            {services.length ? services.map((service) => <option key={service.id} value={service.id}>{service.title} · ₹{Number(service.price).toLocaleString("en-IN")} · {service.duration_minutes} min</option>) : <option value="">No active services available</option>}
          </select>
        )}
        {!loadingServices && !services.length && !error && <p className="mt-2 text-sm text-amber-200">There are no active services to book yet. Please check back soon.</p>}
      </div>

      <div>
        <label htmlFor="booking-date" className="mb-2 block text-sm font-medium">Choose a date</label>
        <input id="booking-date" type="date" min={today} max={addDays(today, 30)} value={date} onChange={(event) => {
          const nextDate = event.target.value;
          if (nextDate && isTuesday(nextDate)) {
            setError("The salon is closed on Tuesdays. Please choose another date.");
            return;
          }
          setDate(nextDate);
        }} className="w-full rounded-lg border border-brand-border bg-brand-background px-3 py-3 text-sm outline-none focus:border-brand-gold" />
        {isTuesday(date) && <p className="mt-2 text-sm text-amber-200">We’re closed on Tuesdays. Please choose another date.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="booking-name" className="mb-2 block text-sm font-medium">Your name</label>
          <input id="booking-name" required maxLength={120} autoComplete="name" value={guestName} onChange={(event) => setGuestName(event.target.value)} className="w-full rounded-lg border border-brand-border bg-brand-background px-3 py-3 text-sm outline-none focus:border-brand-gold" />
        </div>
        <div>
          <label htmlFor="booking-phone" className="mb-2 block text-sm font-medium">Phone number</label>
          <input id="booking-phone" type="tel" required autoComplete="tel" value={guestPhone} onChange={(event) => setGuestPhone(event.target.value)} placeholder="+91 98765 43210" className="w-full rounded-lg border border-brand-border bg-brand-background px-3 py-3 text-sm outline-none focus:border-brand-gold" />
        </div>
      </div>

      {!isTuesday(date) && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Available times</p>
            <p className="text-xs text-brand-muted">Times shown in India Standard Time</p>
          </div>
          {loadingSlots ? <p className="py-4 text-sm text-brand-muted">Checking availability…</p> : slots.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <button key={slot.slot_at} type="button" disabled={!slot.available} onClick={() => setSlotAt(slot.slot_at)} className={`rounded-lg border px-3 py-3 text-sm transition ${slotAt === slot.slot_at ? "border-brand-gold bg-brand-gold text-brand-background" : slot.available ? "border-brand-border hover:border-brand-gold text-brand-foreground" : "cursor-not-allowed border-brand-border/60 text-brand-muted/50"}`} title={slot.available ? `${slot.booked_count} of ${slot.capacity} chairs booked` : "Booked / full"}>
                  {formatTime(slot.slot_at)}
                  {!slot.available && <span className="mt-1 block text-[10px]">Full</span>}
                </button>
              ))}
            </div>
          ) : <p className="py-4 text-sm text-brand-muted">No more slots available for this date.</p>}
        </div>
      )}

      <div className="rounded-xl border border-brand-border bg-brand-background/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-antique">Your appointment</p>
        {selectedService && slotAt ? (
          <div className="mt-3 flex items-start justify-between gap-4 text-sm">
            <div><p className="font-medium">{selectedService.title}</p><p className="mt-1 text-brand-muted">{formattedDate} · {formatTime(slotAt)}</p><p className="mt-1 text-xs text-brand-muted">{selectedService.duration_minutes} minutes</p></div>
            <p className="font-medium text-brand-champagne">₹{Number(selectedService.price).toLocaleString("en-IN")}</p>
          </div>
        ) : <p className="mt-2 text-sm text-brand-muted">Select a service, date and time to see your booking summary.</p>}
      </div>

      <button type="button" disabled={!selectedService || !selectedSlot?.available || submitting} onClick={() => void submitBooking()} className="w-full rounded-full bg-brand-gold px-5 py-3.5 text-sm font-semibold text-brand-background transition hover:bg-brand-champagne disabled:cursor-not-allowed disabled:opacity-40">
        {submitting ? "Requesting appointment…" : "Request appointment"}
      </button>
      <p className="text-center text-xs text-brand-muted">You can book as a guest or <Link href="/login?next=/book" className="text-brand-gold hover:text-brand-champagne">sign in</Link>. Appointments remain pending until confirmed by our team.</p>
    </section>
  );
}
